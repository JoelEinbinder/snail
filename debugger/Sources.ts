import './sources.css';
import { handleKeyEventForTreeItem, selectTreeItem, Tree, TreeItem } from './ui/Tree';
import { Split } from './ui/Split';
import { WebKitProtocol } from '../src/webkitProtocol';
import type { TargetManager, WebKitSession } from './TargetManager';
export class Sources {
  element = document.createElement('div');
  private _fileTree = new FileTree();
  private _split = new Split();
  private _sourcePane = new SourcePane();
  constructor(targetManager: TargetManager) {
    targetManager.addListener({
      targetAdded: target => {
        target.addListener({
          sessionUpdated: session => {
            // session.on('Debugger.scriptParsed', payload => {
              // console.log(payload.scriptId);
              // session.send('Debugger.getScriptSource', { scriptId: payload.scriptId }).then(x => console.log(x))
              // this._fileTree.appendItem(payload.url, () => {
              //   this._sourcePane.showScript(session, payload.scriptId);
              // });
            // });
            // session.send('Debugger.disable', {});
            // session.send('Debugger.enable', {});
        
          },
          frameAdded: frameUUID => {
          },
          frameRemoved: frameUUID => {
          },
        })
      },
      targetRemoved: target => {
      },
    })
    this.element.classList.add('sources');
    this.element.append(this._split.element);
    this._split.first.append(this._fileTree.element);
    this._split.second.append(this._sourcePane.element);
  }

  focus() {
    this._fileTree.focus();
  }
}

class SourcePane {
  element = document.createElement('div');
  private _showing: string | null = null;
  private _cachedSources = new Map<string, Promise<WebKitProtocol.Debugger.getScriptSourceReturnValue>>();
  constructor() {
    this.element.classList.add('source-pane');
  }
  async showScript(session: WebKitSession, scriptId: string) {
    if (this._showing === scriptId)
      return;
    this._showing = scriptId;
    if (!this._cachedSources.has(scriptId))
      this._cachedSources.set(scriptId, session.send('Debugger.getScriptSource', { scriptId }));
    const source = await this._cachedSources.get(scriptId)!;
    this.element.textContent = source.scriptSource;
  }
}

class FileTree {
  private _tree = new Tree();
  get element() {
    return this._tree.element;
  }
  focus() {
    this._tree.focus();
  }
  appendItem(url: string, onShow: () => void) {
    const item = new FileTreeItem(this._tree, url, onShow);
    this._tree.appendItem(item);
  }
}

class FileTreeItem implements TreeItem {
  collapsed = true;
  collapsible = false;
  readonly children = [];
  element = document.createElement('div');
  constructor(public parent: TreeItem, text: string, private _onShow: () => void) {
    this.element.classList.add('file-tree-item');
    this.element.textContent = text;
    this.element.addEventListener('keydown', event => {
      if (event.target !== this.element)
        return;
      if (handleKeyEventForTreeItem(event, this))
        return;
      // todo enter key to handle splitting selection from showing file
    });
    this.element.onclick = () => {
      selectTreeItem(this);
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
