import { handleKeyEventForTreeItem, selectTreeItem, Tree, TreeItem } from './ui/Tree';
import './fileTree.css';
export class FileTree {
  private _tree = new Tree();
  private _folders = new Map<string, FolderTreeItem>();
  constructor() {
    this._tree.element.classList.add('file-tree');
  }
  get element() {
    return this._tree.element;
  }
  focus() {
    this._tree.focus();
  }
  appendItem(url: string, onShow: () => void) {
    const descriptors = urlToDescriptors(url);
    // TODO protocol
    descriptors.shift();
    const folder = descriptors.shift()!;
    if (!this._folders.has(folder.name)) {
      const folderItem = new FolderTreeItem(this._tree, 1, folder.name);
      this._folders.set(folder.name, folderItem);
      this._tree.appendItem(folderItem);
    }
    const item = new FileTreeItem(url, onShow);
    const folderItem = this._folders.get(folder.name)!;
    folderItem.appendItem(descriptors, item);
  }
}

type FolderDescriptor = {
  name: string,
  type: 'protocol' | 'origin' | 'directory',
};

function urlToDescriptors(url: string) {
  const parsed = new URL(url);
  const parts: FolderDescriptor[] = [];
  parts.push({
    name: parsed.protocol,
    type: 'protocol',
  });
  parts.push({
    name: parsed.origin,
    type: 'origin',
  });
  parts.push(...parsed.pathname.split('/').slice(1, -1).map(x => ({
    name: x,
    type: 'directory' as const,
  })));
  return parts;

}

class FolderTreeItem implements TreeItem {
  collapsible = true;
  collapsed = false;
  readonly children: TreeItem[] = [];
  element = document.createElement('div');
  private _childContainer = document.createElement('div');
  private _titleElement = document.createElement('div');
  private _childFolders = new Map<string, FolderTreeItem>();

  constructor(public parent: TreeItem , private _depth: number, text: string) {
    this.element.style.setProperty('--depth', this._depth.toString());
    this.element.classList.add('folder');
    this._childContainer.classList.add('children');
    this._titleElement.classList.add('title');
    this._titleElement.textContent = text;
    
    this.element.append(this._titleElement, this._childContainer);
    this._titleElement.addEventListener('keydown', event => {
      if (event.target !== this._titleElement)
        return;
      if (handleKeyEventForTreeItem(event, this))
        return;
      // todo enter key to handle splitting selection from showing folder
    });
    this._titleElement.onmousedown = e => {
      selectTreeItem(this);
      this.focus();
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    this.setIsSelected(false);
    this.collapse();
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
    this.collapsed = false;
    this.element.classList.toggle('collapsed', false);
  }
  collapse(): void {
    this.collapsed = true;
    this.element.classList.toggle('collapsed', true);
  }

  get depth() {
    return this._depth;
  }

  appendItem(descriptors: FolderDescriptor[], item: FileTreeItem) {
    const folder = descriptors.shift()!;
    if (!folder) {
      this.children.push(item);
      this._childContainer.append(item.element);
      item.element.style.setProperty('--depth', (1 + this._depth).toString());
      item.parent = this;
      return;
    }
    if (!this._childFolders.has(folder.name)) {
      const folderItem = new FolderTreeItem(this, this._depth + 1, folder.name);
      this._childFolders.set(folder.name, folderItem);
      this.children.push(folderItem);
      this._childContainer.append(folderItem.element);
    }
    const folderItem = this._childFolders.get(folder.name)!;
    folderItem.appendItem(descriptors, item);
  }
}

class FileTreeItem implements TreeItem {
  readonly collapsed = true;
  readonly collapsible = false;
  readonly children = [];
  element = document.createElement('div');
  public parent?: TreeItem;
  constructor(url: string, private _onShow: () => void) {
    this.element.classList.add('file-tree-item');
    const parsed = new URL(url);
    const name = parsed.pathname.split('/').slice(-1)[0] || '(index)';
    this.element.textContent = name;
    this.element.title = url;
    this.element.addEventListener('keydown', event => {
      if (event.target !== this.element)
        return;
      if (handleKeyEventForTreeItem(event, this))
        return;
      // todo enter key to handle splitting selection from showing file
    });
    this.element.onmousedown = e => {
      selectTreeItem(this);
      this.focus();
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    this.setIsSelected(false);
  }
  focus(): void {
    this.element.focus();
  }
  hasFocus(): boolean {
    return this.element.ownerDocument.activeElement === this.element;
  }
  setIsSelected(isSelected: boolean): void {
    this.element.classList.toggle('selected', isSelected);
    this.element.tabIndex = isSelected ? 0 : -1;
    if (isSelected)
      this._onShow();
  }
  expand(): void {
    throw new Error('Method not implemented.');
  }
  collapse(): void {
    throw new Error('Method not implemented.');
  }
}
