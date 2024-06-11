import './tabBlock.css';
import { showContextMenu } from './contextMenu';
import type { Action } from "./actions";
import type { QuickPickProvider } from "./QuickPick";
import { SplitBlock, type Block, type BlockDelegate } from './GridPane';
import type { LogView } from './LogView';

export class TabBlock implements Block {
  private _tabs: Block[] = [];
  private _activeTab?: Block;
  private _lastPosition?: { x: number; y: number; width: number; height: number; };
  blockDelegate?: BlockDelegate;
  private _tabBar = document.createElement('div');
  private _addButton?: HTMLElement;
  private _minimizeButton?: HTMLElement;
  private _maximizeButton?: HTMLElement;
  private _closeButton?: HTMLElement;
  private _maximized = false;
  private _headerForTab = new WeakMap<Block, HTMLElement>();
  constructor(private _parentElement: HTMLElement, delegate: {
    onAdd?: () => Promise<Block>,
    onMinimize?: () => Promise<void>,
    setMaximized?: (maximized: boolean) => Promise<void>,
    onClose?: () => Promise<void>,
  } = {}) {
    this._tabBar.classList.add('tab-bar');
    if (delegate.onAdd) {
      this._addButton = document.createElement('button');
      this._addButton.title = 'Open a new tab (Ctrl+T)';
      this._addButton.classList.add('add-button');
      this._tabBar.append(this._addButton);
      this._addButton.onclick = async () => {
        const tab = await delegate.onAdd();
        this.addTab(tab);
        this.switchTab(tab);
      };
    }
    if (delegate.onMinimize) {
      this._minimizeButton = document.createElement('button');
      this._minimizeButton.title = 'Minimize';
      this._minimizeButton.classList.add('minimize-button');
      this._tabBar.append(this._minimizeButton);
      this._minimizeButton.onclick = async () => {
        await delegate.onMinimize();
      };
    }
    if (delegate.setMaximized) {
      this._maximizeButton = document.createElement('button');
      this._maximizeButton.classList.add('maximize-button');
      this._tabBar.append(this._maximizeButton);
      this._maximizeButton.onclick = async () => {
        await delegate.setMaximized(!this._maximized);
      };
    }
    if (delegate.onClose) {
      this._closeButton = document.createElement('button');
      this._closeButton.title = 'Close';
      this._closeButton.classList.add('close-button');
      this._tabBar.append(this._closeButton);
      this._closeButton.onclick = async () => {
        await delegate.onClose();
      };
    }
    this.setMaximized(false);
  }
  async quickPicks(): Promise<QuickPickProvider[]> {
    return this._activeTab?.quickPicks() || [];
  }
  selectSiblingTab(previous: boolean) {
    let index = this._tabs.indexOf(this._activeTab);
    if (previous)
      index--;
    else
      index++;
    index = (index + this._tabs.length) % this._tabs.length;
    const tab = this._tabs[index];
    this.switchTab(tab);
    tab.focus();
}
  close(): void {
    for (const tab of this._tabs)
      tab.close();
  }
  hide(): void {
    this._tabBar.remove();
    this._activeTab?.hide();
  }
  show(): void {
    this._parentElement.append(this._tabBar);
    this._activeTab?.show();
  }
  updatePosition(rect: { x: number; y: number; width: number; height: number; }): void {
    this._tabBar.style.left = rect.x + 'px';
    this._tabBar.style.top = rect.y + 'px';
    this._tabBar.style.width = rect.width + 'px';
    const tabHeight = this._tabBar.getBoundingClientRect().height;
    this._lastPosition = {
      x: rect.x,
      y: rect.y + tabHeight,
      width: rect.width,
      height: rect.height - tabHeight,
    };
    this._activeTab?.updatePosition(this._lastPosition);
  }
  focus(): void {
    this._activeTab?.focus();
  }
  hasFocus(): boolean {
    if (elementHasFocus(this._tabBar))
      return true;
    return this._activeTab?.hasFocus() ?? false;
  }
  async serializeForTest(): Promise<any> {
    return this._activeTab?.serializeForTest();
  }

  setMaximized(maximized) {
    this._maximized = maximized;
    if (!this._maximizeButton)
      return;
    this._maximizeButton.classList.toggle('maximized', maximized);
    this._maximizeButton.title = maximized ? 'Restore' : 'Maximize';
  }

  closeTab(tab: Block) {
    const tabHeader = this._headerForTab.get(tab);
    const headerHadFocus = tabHeader === tabHeader.ownerDocument.activeElement;
    const tabHadFocus = this._activeTab?.hasFocus();
    tabHeader.remove();
    const index = this._tabs.indexOf(tab);
    this._tabs.splice(index, 1);
    this._headerForTab.delete(tab);
    if (this._activeTab === tab) {
      const showing = !!this._tabBar.parentElement;
      if (showing)
        tab.hide();
      delete this._activeTab;
      const newTab = this._tabs[Math.max(index - 1, 0)];
      if (!newTab) {
        this.blockDelegate?.close();
        return;
      }
      this.switchTab(newTab);
      if (headerHadFocus)
        this._headerForTab.get(this._activeTab)?.focus();
      if (tabHadFocus)
        this._activeTab.focus();
    }
    delete tab.blockDelegate;

  }
  addTab(tab: Block) {
    const delegate: BlockDelegate = {
      close: () => {
        this.closeTab(tab);
      },
      replaceWith: block => {
        const active = this._activeTab === tab;
        const hadFocus = tab.hasFocus();
        block.blockDelegate = delegate;
        this._tabs[this._tabs.indexOf(tab)] = block;
        this._headerForTab.set(block, this._headerForTab.get(tab));
        this._headerForTab.delete(tab);
        tab = block;
        if (active) {
          this._activeTab = null;
          this.switchTab(tab);
          if (hadFocus)
            tab.focus();
        }
      },
      split: (newBlock, direction) => {
        const splitBlock = new SplitBlock([tab, newBlock], direction, this._parentElement);
        delegate.replaceWith(splitBlock);
      },
      titleUpdated: () => {
        if (this._activeTab === tab)
          this.blockDelegate?.titleUpdated();
        tabHeader.textContent = tab.title();
      },
    };
    tab.blockDelegate = delegate; 
    const tabHeader = document.createElement('div');
    tabHeader.textContent = tab.title();
    tabHeader.classList.add('tab-header');
    this._headerForTab.set(tab, tabHeader);
    tabHeader.onmousedown = event => {
      if (event.button !== 0)
        return;
      this.switchTab(tab);
      tab.focus();
    };
    tabHeader.oncontextmenu = event => {
      showContextMenu([
        {
          title: 'close',
          accelerator: 'Ctrl+W',
          callback: () => {
            this.closeTab(tab);
          },
        }
      ])
    };
    if (this._addButton)
      this._tabBar.insertBefore(tabHeader, this._addButton);
    else
      this._tabBar.append(tabHeader);
    this._tabs.push(tab);
    if (!this._activeTab)
      this.switchTab(tab);
  }

  switchTab(tab: Block) {
    const hadFocus = this._activeTab?.hasFocus();
    if (this._activeTab) {
      this._headerForTab.get(this._activeTab).classList.remove('selected');
      this._headerForTab.get(this._activeTab).removeAttribute('tabIndex');
    }
    const showing = !!this._tabBar.parentElement;
    if (showing)
      this._activeTab?.hide();
    this._activeTab = tab;
    this._headerForTab.get(tab).classList.add('selected');
    this._headerForTab.get(tab).tabIndex = 0;
    if (this._lastPosition)
      this._activeTab.updatePosition(this._lastPosition);
    if (showing)
      this._activeTab?.show();
    if (hadFocus)
      this._activeTab.focus();
    this.blockDelegate?.titleUpdated();
  }

  title(): string {
    return this._activeTab?.title() || '<empty>';
  }

  actions(): Action[] {
    return [
      this._addButton && { 
        title: 'New Tab',
        shortcut: 'Ctrl+T',
        id: 'new-tab',
        callback: () => this._addButton.click(),
      },
      this._activeTab && {
        title: 'Close Tab',
        shortcut: 'Ctrl+W',
        id: 'close-tab',
        callback: () => this._activeTab.blockDelegate?.close(),
      },
      this._tabs.length > 1 && {
        title: 'Select next tab',
        shortcut: 'Ctrl+Tab',
        id: 'next-tab',
        callback: () => this.selectSiblingTab(false),
      },
      this._tabs.length > 1 && {
        title: 'Select previous tab',
        shortcut: 'Ctrl+Shift+Tab',
        id: 'previous-tab',
        callback: () => this.selectSiblingTab(true),
      },
      ...(this._activeTab?.actions() || []),
    ].filter(x => x);
  }

  async asyncActions(): Promise<Action[]> {
      return this._activeTab?.asyncActions() || [];
  }

  waitForLineForTest(regex: RegExp) {
    return (this._activeTab as LogView)?.waitForLineForTest(regex);
  }
}


function elementHasFocus(element: HTMLElement) {
  let active = element.ownerDocument.activeElement;
  while (active) {
    if (active === element)
      return true;
    active = active.parentElement;
  }
  return false;
}