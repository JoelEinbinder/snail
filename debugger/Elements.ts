import type { TargetManager, WebKitSession } from './TargetManager';
import { WebKitProtocol } from '../src/webkitProtocol';
import './elements.css';
import { Tree, TreeItem, handleKeyEventForTreeItem, selectTreeItem } from './ui/Tree';

export class Elements {
  element = document.createElement('div');
  private _tree = new Tree();
  constructor(targetManager: TargetManager) {
    this.element.append(this._tree.element);
    targetManager.addListener({
      targetAdded: target => {
        let sessionManager: ElementsSessionManager;
        target.addListener({
          sessionUpdated: session => {
            sessionManager = new ElementsSessionManager(session, {
              showFrameNode: node => {
                if (node.parent === this._tree)
                  return;
                node.parent = this._tree;
                this._tree.appendItem(node);
              },
              hideFrameNode: node => {
                node.parent = undefined;
                this._tree.removeItem(node);
              }
            });
            for (const frame of target.frames)
              sessionManager.showFrame(frame);
          },
          frameAdded: frameUUID => {
            sessionManager?.showFrame(frameUUID);
          },
          frameRemoved: frameUUID => {
            sessionManager?.hideFrame(frameUUID);
          },
        })
      },
      targetRemoved: target => {
      },
    })
  }

  focus() {
    this._tree.focus();
  }
}

interface ElementsSessionManagerDelegate {
  showFrameNode(node: RemoteNode): void;
  hideFrameNode(node: RemoteNode): void;
}

class ElementsSessionManager {
  private _nodes = new Map<number, RemoteNode>();
  private _frameIdToNodeID = new Map<string|undefined, number>();
  private _nodeIdToFrameID = new Map<number, string|undefined>();
  private _framesToShow = new Set<string|undefined>();
  private _rootPromise: Promise<number>;
  private _contentDocumentIdToFrameId = new Map<number, string|undefined>();
  constructor(private _session: WebKitSession, private _delegate: ElementsSessionManagerDelegate) {
    this._session.on('DOM.setChildNodes', (event) => {
      const remoteNode = this._nodes.get(event.parentId)!;
      remoteNode.populateChildren(event.nodes.map(node => this._processNode(remoteNode, node)));
    });
    this._session.on('DOM.childNodeCountUpdated', event => {
      const node = this._nodes.get(event.nodeId)!;
      node.data.childNodeCount = event.childNodeCount;
      node._renderTitle();
    });
    this._session.on('DOM.childNodeRemoved', event => {
      this.nodeRemoved(event.nodeId);
    })
    this._session.on('DOM.childNodeInserted', (event) => {
      const parent = this._nodes.get(event.parentNodeId)!;
      const previous = this._nodes.get(event.previousNodeId);
      const newNode = this._processNode(parent, event.node);
      parent.insertChild(newNode, previous);
    });
    // this._session.on("DOM.documentUpdated", (x) => console.log('DOM.documentUpdated', JSON.stringify(x)));
    // this._session.on("DOM.inspect", (x) => console.log('DOM.inspect', JSON.stringify(x)));
    // this._session.on("DOM.setChildNodes", (x) => console.log('DOM.setChildNodes', JSON.stringify(x)));
    // this._session.on("DOM.attributeModified", (x) => console.log('DOM.attributeModified', JSON.stringify(x)));
    // this._session.on("DOM.attributeRemoved", (x) => console.log('DOM.attributeRemoved', JSON.stringify(x)));
    // this._session.on("DOM.inlineStyleInvalidated", (x) => console.log('DOM.inlineStyleInvalidated', JSON.stringify(x)));
    // this._session.on("DOM.characterDataModified", (x) => console.log('DOM.characterDataModified', JSON.stringify(x)));
    // this._session.on("DOM.childNodeCountUpdated", (x) => console.log('DOM.childNodeCountUpdated', JSON.stringify(x)));
    // this._session.on("DOM.childNodeInserted", (x) => console.log('DOM.childNodeInserted', JSON.stringify(x)));
    // this._session.on("DOM.childNodeRemoved", (x) => console.log('DOM.childNodeRemoved', JSON.stringify(x)));
    // this._session.on("DOM.willDestroyDOMNode", (x) => console.log('DOM.willDestroyDOMNode', JSON.stringify(x)));
    // this._session.on("DOM.shadowRootPushed", (x) => console.log('DOM.shadowRootPushed', JSON.stringify(x)));
    // this._session.on("DOM.shadowRootPopped", (x) => console.log('DOM.shadowRootPopped', JSON.stringify(x)));
    // this._session.on("DOM.customElementStateChanged", (x) => console.log('DOM.customElementStateChanged', JSON.stringify(x)));
    // this._session.on("DOM.pseudoElementAdded", (x) => console.log('DOM.pseudoElementAdded', JSON.stringify(x)));
    // this._session.on("DOM.pseudoElementRemoved", (x) => console.log('DOM.pseudoElementRemoved', JSON.stringify(x)));
    // this._session.on("DOM.didAddEventListener", (x) => console.log('DOM.didAddEventListener', JSON.stringify(x)));
    // this._session.on("DOM.willRemoveEventListener", (x) => console.log('DOM.willRemoveEventListener', JSON.stringify(x)));
    // this._session.on("DOM.didFireEvent", (x) => console.log('DOM.didFireEvent', JSON.stringify(x)));
    // this._session.on("DOM.powerEfficientPlaybackStateChanged", (x) => console.log('DOM.powerEfficientPlaybackStateChanged', JSON.stringify(x)));

    this._rootPromise = this.getDocument();
  }

  nodeRemoved(nodeId: number) {
    const isContentDocument = this._contentDocumentIdToFrameId.has(nodeId);
    let frameId: string|undefined;
    if (isContentDocument) {
      frameId = this._contentDocumentIdToFrameId.get(nodeId);
      this._contentDocumentIdToFrameId.delete(nodeId);
    }
    const node = this._nodes.get(nodeId);
    if (!node)
      return;
    this._nodes.delete(nodeId);
    if (isContentDocument) {
      this._delegate.hideFrameNode(node);
      this.getFrameNodeId(frameId);
    }
    for (const child of node.data.children || [])
      this.nodeRemoved(child.nodeId);
  }
  _processNode(parent: TreeItem|undefined, node: WebKitProtocol.DOM.Node) {
    const remoteNode = new RemoteNode(this._session, parent, node);
    this._nodes.set(node.nodeId, remoteNode);
    if (node.children)
      remoteNode.populateChildren(node.children.map(node => this._processNode(remoteNode, node)));
    if (node.contentDocument)
      remoteNode.populateChildren([node.contentDocument].map(node => this._processNode(remoteNode, node)));  
    this.maybeShowFrame(node.nodeId);
    return remoteNode;
  }
  showFrame(frameUUID: string|undefined) {
    this._framesToShow.add(frameUUID);
    if (!this._frameIdToNodeID.has(frameUUID))
      this.getFrameNodeId(frameUUID);
    else {
      const nodeId = this._frameIdToNodeID.get(frameUUID)!;
      this.maybeShowFrame(nodeId);
    }
  }
  hideFrame(frameUUID: string|undefined) {
    this._framesToShow.delete(frameUUID);
    const nodeId = this._frameIdToNodeID.get(frameUUID);
    if (!nodeId)
      return;
    const node = this._nodes.get(nodeId);
    const contentDocumentId = node?.data.contentDocument?.nodeId;
    if (!contentDocumentId)
      return;
    this._contentDocumentIdToFrameId.delete(contentDocumentId);
    const contentDocument = this._nodes.get(contentDocumentId);
    if (!contentDocument)
      return;
    this._delegate.hideFrameNode(contentDocument);
  }
  async getFrameNodeId(frameUUID: string|undefined) {
    const rootId = await this._rootPromise;
    const {nodeId} = await this._session.send('DOM.querySelector', {
      nodeId: rootId,
      selector: `iframe[name="${frameUUID}"]`,
    });
    if (!nodeId)
      return; // could not find frame id. Maybe the log was cleared while querying.
    this._frameIdToNodeID.set(frameUUID, nodeId);
    this._nodeIdToFrameID.set(nodeId, frameUUID);
    this.maybeShowFrame(nodeId);
    return nodeId;
  }
  async maybeShowFrame(nodeId: number) {
    const uuid = this._nodeIdToFrameID.get(nodeId);
    if (!uuid)
      return;
    if (!this._framesToShow.has(uuid))
      return;
    const node = this._nodes.get(nodeId);
    const contentDocumentId = node?.data.contentDocument?.nodeId;
    if (!contentDocumentId)
      return;
    this._contentDocumentIdToFrameId.set(contentDocumentId, uuid);
    const contentDocument = this._nodes.get(contentDocumentId);
    if (!contentDocument)
      return;
    this._delegate.showFrameNode(contentDocument);
  }
  async getDocument() {
    const { root } = await this._session.send('DOM.getDocument', {
    });
    this._frameIdToNodeID.set(undefined, root.nodeId);
    this._processNode(undefined, root);
    return root.nodeId;
  }
}

class RemoteNode implements TreeItem {
  element = document.createElement('div');
  private _collapsed = true;
  children: TreeItem[] = [];
  private _populated = false;
  private _titleElement = document.createElement('div');
  private _childContainer = document.createElement('div');
  private _displayChildrenInline = false;
  private _parent: TreeItem|undefined;
  get parent() {
    return this._parent;
  }
  constructor(
    private _client: WebKitSession,
    parent: TreeItem|undefined,
    public data: WebKitProtocol.DOM.Node) {
    this._titleElement.tabIndex = -1;
    this.element.classList.add('node');
    this._childContainer.classList.add('children');
    this._titleElement.classList.add('title');
    this.element.classList.toggle('collapsed', true);
    this.element.append(this._titleElement, this._childContainer);
    this.parent = parent;
    this._renderTitle();
    this._titleElement.addEventListener('keydown', event => {
      if (event.target !== this._titleElement)
        return;
      handleKeyEventForTreeItem(event, this);
    });
    this._titleElement.addEventListener('mousedown', event => {
      selectTreeItem(this);
    });
  }
  get depth() {
    let depth = 0;
    let parent: TreeItem | undefined = this.parent;
    while (parent) {
      depth++;
      parent = parent.parent;
    }
    return depth;
  }

  set parent(value) {
    this._parent = value;
    this._updateDepth();
  }
  _updateDepth() {
    this.element.style.setProperty('--depth', String(this.depth));
    for (const child of this.children as (RemoteNode|EndTag)[])
      child._updateDepth();
  }
  _renderTitle() {
    this.element.classList.toggle('collapsible', this.collapsible);
    this._titleElement.textContent = '';
    if (this.data.nodeType === Node.TEXT_NODE) {
      this._titleElement.textContent = this.data.nodeValue;
      return;
    }
    if (this.data.nodeType === Node.ELEMENT_NODE) {
      const tagName = this.data.nodeName.toLowerCase();
      const attributes: { name: string, value: string }[] = [];
      for (let i = 0; i < (this.data.attributes || []).length; i += 2) {
        attributes.push({
          name: this.data.attributes![i],
          value: this.data.attributes![i + 1],
        });
      }
      const attributeFragment = document.createDocumentFragment();
      for (const attr of attributes)
        attributeFragment.append(' ', wrapAsAttribute(attr.name + `=`), wrapAsString(JSON.stringify(attr.value)));
      this._titleElement.textContent = '';
      if (this._displayChildrenInline) {
        this._titleElement.append(wrapAsTag(`<${tagName}`), attributeFragment, wrapAsTag('>'));
        for (const child of this.data.children || [])
          this._titleElement.append(child.nodeValue);
        this._titleElement.append(wrapAsTag(`</${tagName}>`));
      } else if (!this.collapsible) {
        this._titleElement.append(wrapAsTag(`<${tagName}`), attributeFragment, wrapAsTag(`>`));
        if (!voidElements.has(tagName))
          this._titleElement.append(wrapAsTag(`</${tagName}>`));
      } else if (this._collapsed) {
        this._titleElement.append(wrapAsTag(`<${tagName}`), attributeFragment, wrapAsTag(`>`), '…', wrapAsTag(`</${tagName}>`));
      } else {
        this._titleElement.append(wrapAsTag(`<${tagName}`), attributeFragment, wrapAsTag(`>`));
      }
      return;
    }
    if (this.data.nodeType === Node.DOCUMENT_NODE) {
      this._titleElement.textContent = `${this.data.nodeName.toLowerCase()}`;
      return;
    }
    if (this.data.nodeType === Node.DOCUMENT_TYPE_NODE) {
      this._titleElement.textContent = '';
      this._titleElement.append(wrapAsDocType(`<!DOCTYPE ${this.data.nodeName}>`));
      return;
    }
    this._titleElement.textContent = `${this.data.nodeName.toLowerCase()}`;
  }
  focus(): void {
    this._titleElement.focus();
  }
  hasFocus(): boolean {
    return this._titleElement.ownerDocument.activeElement === this._titleElement;
  }
  setIsSelected(isSelected: boolean): void {
    this._titleElement.classList.toggle('selected', isSelected);
    this._titleElement.tabIndex = isSelected ? 0 : -1;
  }
  expand(): void {
    this.element.classList.toggle('collapsed', false);
    this._collapsed = false;
    this._renderTitle();
    if (!this._populated) {
      this._client.send('DOM.requestChildNodes', {
        nodeId: this.data.nodeId,
      });
    }
  }
  populateChildren(children: RemoteNode[]) {
    this._populated = true;
    this.data.children = children.map(x => x.data);
    if (children.length === 1 && children.every(child => {
      return child.data.nodeType === Node.TEXT_NODE && !child.data.nodeValue.includes('\n');
    })) {
      this._displayChildrenInline = true;
      this.element.classList.toggle('collapsible', this.collapsible);
      this.children = [];
      this._childContainer.textContent = '';
      this._renderTitle();
      return;
    }

    this.children = [...children];
    if (this.data.nodeType === Node.ELEMENT_NODE)
      this.children.push(new EndTag(this));
    this._childContainer.textContent = '';

    for (const child of this.children)
      this._childContainer.append(child.element);
  }
  insertChild(child: RemoteNode, previous?: RemoteNode) {
    if (!this._populated)
      return;
    const index = previous ? this.children.indexOf(previous) : -1;
    this.children.splice(index + 1, 0, child);
    if (previous)
      this._childContainer.insertBefore(child.element, previous.element.nextSibling);
    else
      this._childContainer.insertBefore(child.element, null);
  }
  collapse(): void {
    this.element.classList.toggle('collapsed', true);
    this._collapsed = true;
    this._renderTitle();
  }
  get collapsed() {
    return this._collapsed || !this._populated;
  }
  get collapsible() {
    return (!!this.data.childNodeCount || !!this.data.contentDocument) && !this._displayChildrenInline;
  }
}

class EndTag implements TreeItem {
  element = document.createElement('div');
  collapsed = true;
  collapsible = false;
  get children(): readonly TreeItem[] {
    return [];
  }

  private _titleElement = document.createElement('div');
  constructor(public parent: RemoteNode) {
    this._titleElement.tabIndex = -1;
    this.element.classList.add('node');
    this._titleElement.classList.add('title');
    this._updateDepth();
    this.element.append(this._titleElement);
    this._renderTitle();
    this._titleElement.addEventListener('keydown', event => {
      if (event.target !== this._titleElement)
        return;
      handleKeyEventForTreeItem(event, this);
    });
    this._titleElement.addEventListener('mousedown', event => {
      selectTreeItem(this);
    });
  }
  _renderTitle() {
    this._titleElement.textContent = '';
    this._titleElement.append(wrapAsTag(`</${this.parent.data.nodeName.toLowerCase()}>`));
  }
  _updateDepth() {
    this.element.style.setProperty('--depth', String(this.depth - 1));
  }
  get depth() {
    let depth = 0;
    let parent: TreeItem | undefined = this.parent;
    while (parent) {
      depth++;
      parent = parent.parent;
    }
    return depth;
  }
  
  focus(): void {
    this._titleElement.focus();
  }
  hasFocus(): boolean {
    return this._titleElement.ownerDocument.activeElement === this._titleElement;
  }
  setIsSelected(isSelected: boolean): void {
    this._titleElement.classList.toggle('selected', isSelected);
    this._titleElement.tabIndex = isSelected ? 0 : -1;
  }
  expand(): void {
    throw new Error('Method not implemented.');
  }
  collapse(): void {
    throw new Error('Method not implemented.');
  }
}

const voidElements = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr', 'command', 'keygen'
]);


function wrapAsTag(content: string) {
  const element = document.createElement('span');
  element.classList.add('tag');
  element.textContent = content;
  return element;
}

function wrapAsDocType(content: string) {
  const element = document.createElement('span');
  element.classList.add('doctype');
  element.textContent = content;
  return element;
}

function wrapAsAttribute(content: string) {
  const element = document.createElement('span');
  element.classList.add('attribute');
  element.textContent = content;
  return element;
}
function wrapAsString(content: string) {
  const element = document.createElement('span');
  element.classList.add('string');
  element.textContent = content;
  return element;
}