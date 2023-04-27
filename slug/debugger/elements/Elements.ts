import type { TargetManager, ChromiumSession } from '../TargetManager';
import './elements.css';
import { Tree, TreeItem, handleKeyEventForTreeItem, selectTreeItem } from '../ui/Tree';
import type { Protocol } from '../../../src/protocol';
import { ChromiumDOM, DOM, RemoteNode } from './ChromiumDOM';

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
            sessionManager = new ElementsSessionManager(new ChromiumDOM(session), {
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

  toJSON() {
    return {
      type: 'Elements',
      tree: this._tree.children.map(x => (x as NodeView).toStringForTest()).join('\n'),
    };
  }
}

interface ElementsSessionManagerDelegate {
  showFrameNode(node: NodeView): void;
  hideFrameNode(node: NodeView): void;
}

class ElementsSessionManager {
  private _hideFrame = new Map<string|undefined, () => void>();
  constructor(private _dom: DOM, private _delegate: ElementsSessionManagerDelegate) {
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
  }
  async showFrame(frameUUID: string|undefined) {
    const frameNodes = new Map<RemoteNode, NodeView>();
    const unsubscribe = this._dom.documentNodeForFrame(frameUUID, {
      nodeAdded: node => {
        const nodeView = new NodeView(node, undefined);
        frameNodes.set(node, nodeView);
        this._delegate.showFrameNode(nodeView);
      },
      nodeRemoved: node => {
        const nodeView = frameNodes.get(node);
        this._delegate.showFrameNode(nodeView);
        frameNodes.delete(node);
      },
    });
    this._hideFrame.set(frameUUID, () => {
      this._hideFrame.delete(frameUUID);
      for (const nodeView of frameNodes.values())
        this._delegate.hideFrameNode(nodeView);
      frameNodes.clear();
      unsubscribe();
    });
  }
  hideFrame(frameUUID: string|undefined) {
    this._hideFrame.get(frameUUID)?.();
    // this._framesToShow.delete(frameUUID);
    // const nodeId = this._frameIdToNodeID.get(frameUUID);
    // if (!nodeId)
    //   return;
    // const node = this._nodes.get(nodeId);
    // const contentDocumentId = node?.data.contentDocument?.nodeId;
    // if (!contentDocumentId)
    //   return;
    // this._contentDocumentIdToFrameId.delete(contentDocumentId);
    // const contentDocument = this._nodes.get(contentDocumentId);
    // if (!contentDocument)
    //   return;
    // this._delegate.hideFrameNode(contentDocument);
  }
  // async maybeShowFrame(nodeId: number) {
  //   const uuid = this._nodeIdToFrameID.get(nodeId);
  //   if (!uuid)
  //     return;
  //   if (!this._framesToShow.has(uuid))
  //     return;
  //   const node = this._nodes.get(nodeId);
  //   const contentDocumentId = node?.data.contentDocument?.nodeId;
  //   if (!contentDocumentId)
  //     return;
  //   this._contentDocumentIdToFrameId.set(contentDocumentId, uuid);
  //   const contentDocument = this._nodes.get(contentDocumentId);
  //   if (!contentDocument)
  //     return;
  //   this._delegate.showFrameNode(contentDocument);
  // }
  toJSON() {
    return {};
  }
}

class NodeView implements TreeItem {
  element = document.createElement('div');
  private _collapsed = true;
  children: TreeItem[] = [];
  private _titleElement = document.createElement('div');
  private _childContainer = document.createElement('div');
  private _displayChildrenInline = false;
  private _parent: TreeItem|undefined;
  get parent() {
    return this._parent;
  }
  constructor(
    private _node: RemoteNode,
    parent: TreeItem|undefined) {
    this._titleElement.tabIndex = -1;
    this.element.classList.add('node');
    this._childContainer.classList.add('children');
    this._titleElement.classList.add('title');
    this.element.classList.toggle('collapsed', true);
    this.element.append(this._titleElement, this._childContainer);
    this.parent = parent;
    this._renderTitle();
    this._node.updated.on(() => {
      if (!this.parent)
        console.log('updated', this._node.data.childNodeCount);
      if (this._shouldExpandByDefault() && this.collapsed)
        this.expand();
      this._renderTitle();
    });
    this._titleElement.addEventListener('keydown', event => {
      if (event.target !== this._titleElement)
        return;
      handleKeyEventForTreeItem(event, this);
    });
    this._titleElement.addEventListener('mousedown', event => {
      selectTreeItem(this);
    });
    this._titleElement.addEventListener('mouseenter', event => {
      this._node.highlight();
    });
    this._node.addListener({
      childNodesSet: () => {
        // TODO set
        this.populateChildren(this._node.children());
      },
      childNodeInserted: event => {
        // TODO inserted
      },
      childNodeRemoved: event => {
        // TODO removed
        console.log('todo child  node removed');
      },
    });
    if (this._shouldExpandByDefault())
      this.expand();
  }

  private _shouldExpandByDefault() {
    if (!this.collapsible)
      return false;
    // if the parent is the tree, we are the document and should expand
    if (!this.parent || !this.parent.parent)
      return true;
    if (this._node.data.nodeName === 'HTML')
      return true;
    if (this._node.data.nodeName === 'BODY')
      return true;
    return false;
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
    for (const child of this.children as (NodeView|EndTag)[])
      child._updateDepth();
  }
  _renderTitle() {
    this.element.classList.toggle('collapsible', this.collapsible);
    this._titleElement.textContent = '';
    if (this._node.data.nodeType === Node.TEXT_NODE) {
      this._titleElement.textContent = this._node.data.nodeValue;
      return;
    }
    if (this._node.data.nodeType === Node.ELEMENT_NODE) {
      const tagName = this._node.data.nodeName.toLowerCase();
      const attributes: { name: string, value: string }[] = [];
      for (let i = 0; i < (this._node.data.attributes || []).length; i += 2) {
        attributes.push({
          name: this._node.data.attributes![i],
          value: this._node.data.attributes![i + 1],
        });
      }
      const attributeFragment = document.createDocumentFragment();
      for (const attr of attributes)
        attributeFragment.append(' ', wrapAsAttribute(attr.name + `=`), wrapAsString(JSON.stringify(attr.value)));
      this._titleElement.textContent = '';
      if (this._displayChildrenInline) {
        this._titleElement.append(wrapAsTag(`<${tagName}`), attributeFragment, wrapAsTag('>'));
        for (const child of this._node.data.children || [])
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
    if (this._node.data.nodeType === Node.DOCUMENT_NODE) {
      this._titleElement.textContent = `${this._node.data.nodeName.toLowerCase()}`;
      return;
    }
    if (this._node.data.nodeType === Node.DOCUMENT_TYPE_NODE) {
      this._titleElement.textContent = '';
      this._titleElement.append(wrapAsDocType(`<!DOCTYPE ${this._node.data.nodeName}>`));
      return;
    }
    this._titleElement.textContent = `${this._node.data.nodeName.toLowerCase()}`;
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
    if (isSelected)
      this._node.highlight();
  }
  expand(): void {
    this.element.classList.toggle('collapsed', false);
    this._collapsed = false;
    this._renderTitle();
    this._node.requestChildNodes();
  }
  populateChildren(children: RemoteNode[]) {
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

    this.children = [...children].map(c => new NodeView(c, this));
    if (this._node.data.nodeType === Node.ELEMENT_NODE)
      this.children.push(new EndTag(this));
    this._childContainer.textContent = '';

    for (const child of this.children)
      this._childContainer.append(child.element);
  }
  insertChild(child: NodeView, previous?: NodeView) {
    if (!this._node.children())
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
    return this._collapsed || !this._node.children();
  }
  get collapsible() {
    return (!!this._node.data.childNodeCount || !!this._node.data.contentDocument) && !this._displayChildrenInline;
  }

  nodeName() {
    return this._node.data.nodeName;
  }

  toStringForTest() {
    const text = this._titleElement.textContent;
    if (this.collapsed)
      return text;
    const children = this.children.map(child => (child as NodeView).toStringForTest().split('\n').map(x => '  ' + x)).flat().join('\n');
    return text + '\n' + children;
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
  constructor(public parent: NodeView) {
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
    this._titleElement.append(wrapAsTag(`</${this.parent.nodeName().toLowerCase()}>`));
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
  toStringForTest() {
    return this._titleElement.textContent;
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