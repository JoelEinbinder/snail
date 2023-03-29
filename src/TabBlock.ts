import type { Block, BlockDelegate } from "./GridPane";
import './tabBlock.css';
import { showContextMenu } from './contextMenu';
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
  private _shortcutListener = (event: KeyboardEvent) => {
    if (!this.hasFocus())
      return;
    if (this._activeTab && event.ctrlKey && event.code === 'KeyW') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.closeTab(this._activeTab);
    }
    if (this._addButton && event.ctrlKey && event.code === 'KeyT') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this._addButton.click();
    }
    if (this._tabs.length > 1 && event.ctrlKey && event.code === 'Tab') {
      event.preventDefault();
      event.stopImmediatePropagation();
      let index = this._tabs.indexOf(this._activeTab);
      if (event.shiftKey)
        index--;
      else
        index++;
      index = (index + this._tabs.length) % this._tabs.length;
      const tab = this._tabs[index];
      this.switchTab(tab);
      tab.focus();
    }
  }
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
  close(): void {
    for (const tab of this._tabs)
      tab.close();
  }
  hide(): void {
    this._tabBar.remove();
    this._activeTab?.hide();
    window.removeEventListener('keydown', this._shortcutListener);
  }
  show(): void {
    this._parentElement.append(this._tabBar);
    this._activeTab?.show();
    window.addEventListener('keydown', this._shortcutListener);
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
    tab.blockDelegate = {
      close: () => {
        this.closeTab(tab);
      },
      replaceWith: block => {
        throw new Error('not implemented');
      },
      split(newBlock, direction) {
        
      },
      titleUpdated: () => {
        if (this._activeTab === tab)
          this.blockDelegate?.titleUpdated();
        tabHeader.textContent = tab.title();
      },

    }
    const tabHeader = document.createElement('div');
    tabHeader.textContent = tab.title();
    tabHeader.classList.add('tab-header');
    this._headerForTab.set(tab, tabHeader);
    tabHeader.onclick = () => {
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