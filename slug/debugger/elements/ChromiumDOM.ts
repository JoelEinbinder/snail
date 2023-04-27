import type { ChromiumSession } from '../TargetManager';
import type { Protocol } from '../../../src/protocol';
import { JoelEvent } from '../../cdp-ui/JoelEvent';
import { RPC, type Transport} from '../../protocol/RPC-ts';

export interface DOM {
  documentNodeForFrame(frameUUID: string|undefined, listener: {
    nodeAdded: (node: RemoteNode) => void,
    nodeRemoved: (node: RemoteNode) => void,
  }): () => void;
}

export interface RemoteNode {
  highlight(): void;
  readonly updated: JoelEvent<void>;
  data: Protocol.DOM.Node;
  requestChildNodes(): void;
  children(): null|RemoteNode[];
  addListener(listener: DOMListener): void;
  removeListener(listener: DOMListener): void;
}

export interface DOMListener {
  childNodesSet(): void;
  childNodeRemoved(child: RemoteNode): void;
  childNodeInserted(event: { child: RemoteNode, previous?: RemoteNode }): void;
}
type NodeListener = {
  nodeAdded: (node: RemoteNode) => void;
  nodeRemoved: (node: RemoteNode) => void;
};
export class ChromiumDOM implements DOM {
  private _nodes = new Map<number, ChromiumRemoteNode>();
  private _frameIdToNodeID = new Map<string|undefined, number>();
  private _nodeIdToFrameID = new Map<number, string|undefined>();
  private _frameNodeListeners = new Map<string|undefined, Set<NodeListener>>();
  private _targets = new Set();
  private _rootNode: ChromiumRemoteNode;
  constructor(private _client: ChromiumSession) {
    this._rootNode = new ChromiumRemoteNode(this._client);
    this._client.send('DOM.enable', {});
    this._client.send('Overlay.enable', {});
    this._client.send('Target.setDiscoverTargets', { discover: true });
    // this._client.on('Target.targetCreated', ({targetInfo}) => {
    //   if (targetInfo.type !== 'iframe')
    //     return;
    //   console.log('target created', targetInfo);
    // });
    // this._client.on('Target.targetDestroyed', ({targetId}) => {
    //   console.log('target destroyed', targetId);
    // });
    this._client.send('Target.setDiscoverTargets', {discover: true})
    this._client.on('DOM.setChildNodes', event => {
      const parent = this._nodes.get(event.parentId)!;
      parent.setChildNodes(event.nodes.map(node => this._ensureNode(node)));
    });
    this._client.on('DOM.childNodeCountUpdated', event => {
      const remoteNode = this._nodes.get(event.nodeId);
      remoteNode.data.childNodeCount = event.childNodeCount;
      remoteNode.updated.dispatch();
    });
    this._client.on('DOM.childNodeRemoved', event => {
      const parent = this._nodes.get(event.parentNodeId);
      const child = this._nodes.get(event.nodeId);
      parent.childNodeRemoved(child);
    });
    this._client.on('DOM.childNodeInserted', event => {
      const parent = this._nodes.get(event.parentNodeId);
      const newNode = this._ensureNode(event.node);
      const previousNode = this._nodes.get(event.previousNodeId);
    });
    this._client.on('DOM.documentUpdated', async event => {
      this._documentUpdated();
    });
    this._documentUpdated();
  }
  private async _getFrameNodeId(frameUUID: string|undefined) {
    const documentNode = await this._documentUpdated();
    const {nodeId} = await this._client.send('DOM.querySelector', {
      nodeId: documentNode.data.nodeId,
      selector: `iframe[name="${frameUUID}"]`,
    });
    if (!nodeId)
      return; // could not find frame id. Maybe the log was cleared while querying.
    this._frameIdToNodeID.set(frameUUID, nodeId);
    this._nodeIdToFrameID.set(nodeId, frameUUID);
    // this.maybeShowFrame(nodeId);
    this._maybeReportFrameAdded(this._nodes.get(nodeId)!);
    return nodeId;
  }
  async _documentUpdated() {
    const { root } = await this._client.send('DOM.getDocument', {
    });
    this._frameIdToNodeID.set(undefined, root.nodeId);
    this._rootNode.setData(root, node => this._ensureNode(node));
    return this._rootNode;
  }
  documentNodeForFrame(frameUUID: string, listener: NodeListener): () => void {
    console.log('documentNodeForFrame', frameUUID);
    if (!this._frameNodeListeners.has(frameUUID))
      this._frameNodeListeners.set(frameUUID, new Set());
    this._frameNodeListeners.get(frameUUID)!.add(listener);
    if (this._frameIdToNodeID.has(frameUUID))
      listener.nodeAdded(this._nodes.get(this._frameIdToNodeID.get(frameUUID)!));
    else
      this._getFrameNodeId(frameUUID);
    return () => {
      const set = this._frameNodeListeners.get(frameUUID);
      set!.delete(listener);
      if (!set.size)
        this._frameNodeListeners.delete(frameUUID);
    };
  }

  private _ensureNode(payload: Protocol.DOM.Node) : ChromiumRemoteNode {
    if (!this._nodes.has(payload.nodeId)) {
      const remoteNode = new ChromiumRemoteNode(this._client);
      this._nodes.set(payload.nodeId, remoteNode);
      remoteNode.setData(payload, node => this._ensureNode(node));
      this._maybeReportFrameAdded(remoteNode);
    }
    return this._nodes.get(payload.nodeId);    
  }

  private async _maybeReportFrameAdded(node: ChromiumRemoteNode) {
    const uuid = this._nodeIdToFrameID.get(node.data.nodeId);
    if (!uuid)
      return;
    if (!this._frameNodeListeners.has(uuid))
      return;
    if (node.data.frameId && !node.data.contentDocument) {
      this._attachToOopif(node);
      return;
    }
    const contentDocumentId = node.data.contentDocument?.nodeId;
    if (!contentDocumentId)
      return;
    // this._contentDocumentIdToFrameId.set(contentDocumentId, uuid);
    const contentDocument = this._nodes.get(contentDocumentId);
    if (!contentDocument)
      return;
    for (const listener of this._frameNodeListeners.get(uuid)!)
      listener.nodeAdded(contentDocument);
  }

  private async _attachToOopif(frameNode: ChromiumRemoteNode) {
    console.log('_attachToOopif', frameNode.data.frameId)
    const uuid = this._nodeIdToFrameID.get(frameNode.data.nodeId)!;
    const {sessionId} = await this._client.send('Target.attachToTarget', {
      targetId: frameNode.data.frameId,
    });
    const transport: Transport = {
      send: (message) => {
        this._client.send('Target.sendMessageToTarget', {
          message: JSON.stringify(message),
          sessionId,
        });
      }
    };
    const session: ChromiumSession = new RPC(transport);
    this._client.on('Target.receivedMessageFromTarget', event => {
      if (event.sessionId !== sessionId)
        return;
      transport.onmessage?.(JSON.parse(event.message));
    });
    const newDom = new ChromiumDOM(session);
    for (const listener of this._frameNodeListeners.get(uuid) || [])
      listener.nodeAdded(newDom.rootNote());
    // for (const listener of this._frameNodeListeners.get(uuid) || [])
    //   newDom.documentNodeForFrame(undefined, )
  }
  
  rootNote() {
    return this._rootNode;
  }
}

class ChromiumRemoteNode implements RemoteNode {
  readonly updated = new JoelEvent<void>(undefined);
  private _children: ChromiumRemoteNode[]|null = null;
  private _listeners = new Set<DOMListener>();
  public data: Protocol.DOM.Node = {
    backendNodeId: -1,
    localName: 'loading',
    nodeId: -1,
    nodeName: 'loading',
    nodeType: -1,
    nodeValue: 'loading',
  }
  constructor(private _session: ChromiumSession, ) {
  }
  setChildNodes(nodes: ChromiumRemoteNode[]) {
    this._children = nodes;
    for (const listener of this._listeners)
      listener.childNodesSet();
  }
  highlight() {
    highlightManager.highlight(this._session, this.data.nodeId);
  }

  setData(data: Protocol.DOM.Node, nodeMaker: (node: Protocol.DOM.Node) => ChromiumRemoteNode) {
    this.data = data;
    this.updated.dispatch();
    if (this.data.children)
      this.setChildNodes(this.data.children.map(node => nodeMaker(node)));
    else if (this.data.contentDocument)
      this.setChildNodes([this.data.contentDocument].map(node => nodeMaker(node)));  
  }

  async requestChildNodes() {
    const done = d4.startAsyncWork('requestChildNodes');
    this._session.send('DOM.requestChildNodes', {
      nodeId: this.data.nodeId,
    }).finally(done);
  }
  children(): null | RemoteNode[] {
    return this._children;
  }
  addListener(listener: DOMListener) {
    this._listeners.add(listener);
    if (this._children)
      listener.childNodesSet();
  }
  removeListener(listener: DOMListener) {
    this._listeners.delete(listener);
  }
  childNodeRemoved(child: ChromiumRemoteNode) {
    for (const listener of this._listeners)
      listener.childNodeRemoved(child);
  }
}


class HighlightManager {
  private _highlightedSession?: ChromiumSession;
  private _highlightTimeout?: any;
  closeHighlight() {
    if (!this._highlightedSession)
      return;
    this._highlightedSession.send('DOM.hideHighlight', {});
    if (this._highlightTimeout)
      clearTimeout(this._highlightTimeout);
    delete this._highlightTimeout;
    delete this._highlightedSession;
  }
  highlight(session: ChromiumSession, nodeId: number) {
    this.closeHighlight();
    this._highlightedSession = session;
    session.send('DOM.highlightNode', {
      nodeId,
      highlightConfig: {
        contentColor: { r: 0, g: 255, b: 0, a: 0.5 },
        marginColor: { r: 0, g: 255, b: 0, a: 0.5 },
        paddingColor: { r: 0, g: 255, b: 0, a: 0.5 },
        borderColor: { r: 0, g: 255, b: 0, a: 0.5 },
        showInfo: true,
      }
    }).catch(e => console.error(e));
    this._highlightTimeout = setTimeout(() => this.closeHighlight(), 5000);
  }
}

const highlightManager = new HighlightManager();