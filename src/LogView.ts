import type { Shell, ShellDelegate } from './Shell';
import './shell.css';
import './logView.css';
import { Block, BlockDelegate } from './GridPane';
import { startAyncWork } from './async';
import { makeLazyProxy } from './LazyProxy';
import { UIThrottle } from './UIThrottle';
import type { Action } from './actions';
import type { LogItem } from './LogItem';
import { Find, Findable, FindableList, type FindParams } from './Find';
import { attachMenuItemsToContextMenuEvent } from './contextMenu';
import { QuickPickProvider, showQuickPick } from './QuickPick';

export class LogView implements Block, ShellDelegate, Findable {
  private _element = document.createElement('div');
  private _scroller = document.createElement('div');
  private _fullscreenElement = document.createElement('div');
  private _prompt?: LogItem;
  private _lockingScroll = false;
  private _undoFullscreen: () => void = null;
  private _log = new FindableList<LogItem>();
  private _activeItem: LogItem | null = null;
  private _activeItemListeners = new Set<() => void>();
  private _itemToElement = new WeakMap<LogItem, Element>();
  private _itemToParent = new WeakMap<LogItem, LogItem>();
  private _itemToRetainers = new WeakMap<LogItem, Set<LogItem>>();
  private _suffixThrottle = new UIThrottle('', () => {
    this.blockDelegate?.titleUpdated();
  });
  private _titleThrottle = new UIThrottle('Loading...', () => {
    this.blockDelegate?.titleUpdated();
  });
  private _find = new Find(this, () => this.focus());
  blockDelegate?: BlockDelegate;
  constructor(private _shell: Shell, private _container: HTMLElement) {
    this._fullscreenElement.classList.add('fullscreen-element');
    this._element.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!this._prompt)
        return;
      if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey)
        return;
      const element = document.activeElement as HTMLElement;
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' || element.isContentEditable)
        return;
      if (event.defaultPrevented)
        return;
      this._prompt.focus();
    }, false);
    this._container.appendChild(this._element);
    this._scroller.classList.add('log-view-scroller');
    this._element.classList.add('log-view');
    this._element.append(this._scroller);
    this._scroller.addEventListener('scroll', event => {
      for (const item of this._log)
        item.onScroll?.();
    }, { passive: true });
    this.hide();
  }
  hide(): void {
    this._element.style.display = 'none';
  }
  show(): void {
    this._element.style.removeProperty('display');
  }
  title(): string {
    return this._titleThrottle.value + this._suffixThrottle.value;
  }
  close(): void {
    this._element.remove();
    this._shell.close();
  }

  setActiveItem(item: LogItem|null) {
    this._activeItem = item;
    item?.focus();
    this._activeItemListeners.forEach(listener => listener());
  }

  togglePrompt(showPrompt: boolean): void {
    if (showPrompt) {
      this._addPrompt();
    } else {
      this._prompt?.dispose();
      delete this._prompt;
    }
  }

  focus(): void {
    if (this._prompt)
      this._prompt?.focus();
    else if (this._activeItem)
      this._activeItem.focus();
  }
  hasFocus(): boolean {
    return this._element.contains(document.activeElement);
  }

  addItem(item: LogItem, parent?: LogItem) {
    this._log.push(item);
    if (parent && !parent.acceptsChildren)
      throw new Error('Parent does not accept children');
    
    const element = !item.acceptsChildren ? item.render() : this._wrapItem(item);
    if (!element)
      return;
    this._itemToElement.set(item, element);
    item.willResizeEvent.on(async () => {
      this._lockScroll();
    });
    this._lockScroll();
    if (parent) {
      const parentWrapper = this._itemToElement.get(parent);
      parentWrapper.appendChild(element);
      this._itemToParent.set(item, parent);
      this._itemToRetainers.get(parent).add(item);
    } else {
      if (this._prompt)
        this._scroller.insertBefore(element, this._prompt.render());
      else
        this._scroller.appendChild(element);
    }
    this._itemToRetainers.set(item, new Set([item]));
    if (item === this._activeItem)
      item.focus();
  }

  private _wrapItem(item: LogItem): Element {
    const itemElement = item.render();
    const toggleFold = (f) => {
      folded = f;
      element.classList.toggle('folded', folded);
    };
    item.toggleFold?.on(toggleFold);
    const element = document.createElement('div');
    element.classList.add('log-item-wrapper');
    let folded = false;
    element.addEventListener('contextmenu', event => {
      attachMenuItemsToContextMenuEvent([{
        title: folded ? 'Unfold' : 'Fold',
        callback: () => toggleFold(!folded),
      }, {
        title: 'Clear command and output',
        callback: () => this.removeItem(item, true),
      }], event);
    }, false);
    if (itemElement)
      element.append(itemElement);
    return element;
  }

  removeItem(item: LogItem, force = false) {
    if (!force) {
      const retainers = this._itemToRetainers.get(item);
      retainers.delete(item);
      // something needs this item to still exist
      if (retainers.size > 0)
        return;
    }
    if (!this._log.removeItem(item))
      return;
    if (item.acceptsChildren) {
      for (const child of this._log) {
        if (this._itemToParent.get(child) === item)
          this.removeItem(child, true);
      }
    }
    const parent = this._itemToParent.get(item);
    if (parent) {
      const retainers = this._itemToRetainers.get(parent);
      retainers.delete(item);
      if (retainers.size === 0)
        this.removeItem(parent, true);
    }
    item.dispose();
    this._lockScroll();
    this._itemToElement.get(item)?.remove();
    this._itemToElement.delete(item);
    this._itemToParent.delete(item);
    this._itemToRetainers.delete(item);
  }

  clearAllExcept(savedItem: LogItem): void {
    for (const item of [...this._log]) {
      if (item !== savedItem)
        this.removeItem(item, false);
    }
  }

  clearAll(): void {
    for (const item of [...this._log])
      this.removeItem(item, true);
  }

  shellClosed() {
    this.blockDelegate.close();
    this._element.remove();
  }

  async _doSplit(direction: 'horizontal' | 'vertical') {
    const logViewProxy = makeLazyProxy<ShellDelegate>();
    const shell = new (await import('./Shell')).Shell(logViewProxy.proxy);
    await shell.setupInitialConnection();
    const view = new LogView(shell, this._container);
    this.blockDelegate.split(view, direction);
    logViewProxy.fulfill(view);
  }

  updatePosition(rect: { x: number; y: number; width: number; height: number; }): void {
    this._lockScroll();
    this._element.style.left = rect.x + 'px';
    this._element.style.top = rect.y + 'px';
    this._element.style.width = rect.width + 'px';
    this._element.style.height = rect.height + 'px';
    this._shell.updateSize(rect.width, rect.height);
  }

  setFullscreenItem(fullScreenEntry: LogItem | null) {
    if (fullScreenEntry) {
      this._scroller.classList.add('inert');
      const placeholder = document.createElement('div');
      const element = fullScreenEntry.render();
      element.parentElement.replaceChild(placeholder, element);
      this._element.appendChild(this._fullscreenElement);
      this._fullscreenElement.appendChild(element);
      this._element.classList.add('fullscreen-entry');
      fullScreenEntry.focus();
      this._undoFullscreen = () => {
        placeholder.parentElement.replaceChild(element, placeholder);
      };
    } else {
      if (this._undoFullscreen) {
        this._undoFullscreen();
        this._undoFullscreen = null;
      }
      this._fullscreenElement.remove();
      this._fullscreenElement.textContent = '';
      this._scroller.classList.remove('inert');
      this._element.classList.remove('fullscreen-entry');
    }
  }

  async _lockScroll() {
    if (this._lockingScroll)
      return;
    const scrollBottom = this._scroller.scrollHeight - this._scroller.scrollTop - this._scroller.offsetHeight;
    this._lockingScroll = true;
    await Promise.resolve();
    this._lockingScroll = false;
    this._scroller.scrollTop = this._scroller.scrollHeight - this._scroller.offsetHeight - Math.floor(scrollBottom);
  }

  _addPrompt() {
    this._lockScroll();
    this._prompt = this._shell.addPrompt(this._scroller);
    this._prompt.willResizeEvent.on(() => this._lockScroll());
  }

  async serializeForTest() {
    if (this._activeItem?.isFullscreen?.())
      return this._activeItem.serializeForTest();
    return {
      log: (await Promise.all(this._log.map(item => {
        return item.serializeForTest ? item.serializeForTest() : '<unknown>';
      }))).filter(x => x),
      prompt: await this._prompt?.serializeForTest(),
    };
  }

  async waitForLineForTest(regex: RegExp) {
    const abortController = new AbortController();
    const callback = () => {
      this._activeItem?.waitForLineForTest?.(regex, abortController.signal).then(resolve);
    };
    let resolve: () => void;
    const promise = new Promise<void>(x => resolve = x);
    this._activeItemListeners.add(callback);
    callback();
    await promise;
    this._activeItemListeners.delete(callback);
    abortController.abort();
  }

  setTitle(title: string): void {
    this._titleThrottle.update(title);
  }

  setSuffix(suffix: string): void {
    this._suffixThrottle.update(suffix);
  }

  get _isFullscreen() {
    return !!this._fullscreenElement.parentElement;
  }

  actions(): Action[] {
    if (this._isFullscreen)
      return [];
    return [{
      title: 'Clear log',
      shortcut: 'Ctrl+L',
      id: 'log.clear',
      callback: () => this.clearAll(),
    }, {
      title: 'Split vertically',
      shortcut: 'Ctrl+A %',
      id: 'log.split.vertical',
      callback: () => this._doSplit('vertical'),
    }, {
      title: 'Split horizontally',
      shortcut: 'Ctrl+A "',
      id: 'log.split.horizontal',
      callback: () => this._doSplit('horizontal'),
    }, {
      title: 'Toggle daemon mode',
      shortcut: 'Ctrl+A D',
      id: 'log.toggle.daemon',
      callback: () => {
        const done = startAyncWork('demon mode toggle');
        this._shell.toggleDaemon().then(done);
      }
    }, {
      title: 'Refresh active iframe',
      shortcut: 'Ctrl+A R',
      id: 'log.refresh.active.iframe',
      callback: () => this._shell.refreshActiveIframe(),
    }, {
      title: 'Find',
      shortcut: 'CmdOrCtrl+F',
      id: 'log.find',
      callback: () => {
        this._find.open(this._element);
      },
    }, {
      title: 'Fold all',
      id: 'log.fold.all',
      shortcut: 'CmdOrCtrl+K O',
      callback: () => {
        this._lockScroll();
        for (const item of this._log)
          item?.toggleFold?.dispatch(true);
      }
    }, {
      title: 'Unfold all',
      id: 'log.unfold.all',
      shortcut: 'CmdOrCtrl+K J',
      callback: () => {
        this._lockScroll();
        for (const item of this._log)
          item?.toggleFold?.dispatch(false);
      }
    }, {
      title: 'Select file',
      id: 'log.file',
      shortcut: 'CmdOrCtrl+P',
      callback: () => {
        showQuickPick('');
      }
    }];
  }

  async quickPicks(): Promise<QuickPickProvider[]> {
    let filesPromise: Promise<void>|undefined;
    const listeners = new Set<(file: string) => void>();
    const cachedFiles: string[] = [];
    const maxFiles = 10000;
    return [{
      title: 'Select file',
      prefix: '',
      items: async (signal, callback, warn) => {
        if (!filesPromise) {
          filesPromise = this._shell.findAllFiles(maxFiles, file => {
            cachedFiles.push(file);
            for (const listener of listeners)
              listener(file);
          });
        }
        const reportFile = (file: string) => callback({
          callback: () => {
            const active = this._activeItem || this._prompt;
            active?.recieveFilePath?.(file);    
          },
          title: file,  
        });
        for (const file of cachedFiles)
          reportFile(file);
        listeners.add(reportFile);
        await filesPromise;
        if (cachedFiles.length >= maxFiles)
          warn(`File limit reached, only searching first ${maxFiles.toLocaleString()} files.`)
        listeners.delete(reportFile);
      }
    }];
  }

  async asyncActions(): Promise<Action[]> {
    const promises: Promise<Action[]>[] = [];
    for (const item of this._log) {
      if (!item.aysncActions)
        continue;
      promises.push(item.aysncActions());
    }
    const actions = await Promise.all(promises);
    return actions.flat();
  }

  setFind(params: FindParams|null): void {
    this._log.setFind(params);
  }

}