import type { JoelEvent } from '../slug/cdp-ui/JoelEvent';
import type { Shell, ShellDelegate } from './Shell';
import './shell.css';
import './logView.css';
import { Block, BlockDelegate } from './GridPane';
import { startAyncWork } from './async';
import { makeLazyProxy } from './LazyProxy';
import { UIThrottle } from './UIThrottle';

export class LogView implements Block, ShellDelegate {
  private _element = document.createElement('div');
  private _scroller = document.createElement('div');
  private _fullscreenElement = document.createElement('div');
  private _prompt?: LogItem;
  private _lockingScroll = false;
  private _undoFullscreen: () => void = null;
  private _removeListeners: () => void;
  private _log: LogItem[] = [];
  private _activeItem: LogItem | null = null;
  private _activeItemListeners = new Set<() => void>();
  private _itemToElement = new WeakMap<LogItem, Element>();
  private _suffixThrottle = new UIThrottle('', () => {
    this.blockDelegate?.titleUpdated();
  });
  private _titleThrottle = new UIThrottle('Loading...', () => {
    this.blockDelegate?.titleUpdated();
  });
  blockDelegate?: BlockDelegate;
  constructor(private _shell: Shell, private _container: HTMLElement) {
    this._fullscreenElement.classList.add('fullscreen-element');
    this._removeListeners = () => {
      document.body.removeEventListener('keydown', keyDownListener, false);
    };  
    const keyDownListener = (event: KeyboardEvent) => {
      if (!this._prompt)
        return;
      if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey)
        return;
      const element = event.target as HTMLElement;
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' || element.isContentEditable)
        return;
      if (event.defaultPrevented)
        return;
      this._prompt.focus();
    };
    this._container.appendChild(this._element);
    document.body.addEventListener('keydown', keyDownListener, false);
    let chording = false;
    this._element.addEventListener('keydown', event => {
      if (event.defaultPrevented)
        return;
      if (!chording) {
        if (event.code === 'KeyA' && event.ctrlKey) {
          chording = true;
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      } else {
        if (event.key !== 'Shift' && event.key !== 'Control' && event.key !== 'Alt' && event.key !== 'Meta') {
          chording = false;
        }
        if (event.key === '%') {
          this._doSplit('vertical');
          event.preventDefault();
        } else if (event.key === '"') {
          this._doSplit('horizontal');
          event.preventDefault();
          event.stopImmediatePropagation();
        } else if (event.code === 'KeyD') {
          event.preventDefault();
          event.stopImmediatePropagation();
          const done = startAyncWork('demon mode toggle');
          this._shell.toggleDaemon().then(done);
        } else if (event.code === 'KeyR') {
          this._shell.refreshActiveIframe();
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
    }, true);
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
    this._element.style.display = 'block';
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

  addItem(item: LogItem) {
    this._log.push(item);
    this._addEntry(item);
  }

  removeItem(item: LogItem) {
    const index = this._log.indexOf(item);
    if (index === -1)
      return;
    item.dispose();
    this._log.splice(index, 1);
    this._lockScroll();
    this._itemToElement.get(item).remove();
    this._itemToElement.delete(item);
  }

  clearAllExcept(savedItem: LogItem): void {
    for (const item of [...this._log]) {
      if (item !== savedItem)
        this.removeItem(item);
    }
  }

  clearAll(): void {
    for (const item of [...this._log])
      this.removeItem(item);
  }

  shellClosed() {
    this._removeListeners();
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

  _addEntry(logItem: LogItem) {
    const element = logItem.render();
    if (!element)
      return;
    this._itemToElement.set(logItem, element);
    logItem.willResizeEvent.on(async () => {
      this._lockScroll();
    });
    this._lockScroll();
    if (this._prompt)
      this._scroller.insertBefore(element, this._prompt.render());
    else
      this._scroller.appendChild(element);
    if (logItem === this._activeItem)
      logItem.focus();
  }

  async _lockScroll() {
    if (this._lockingScroll)
      return;
    const scrollBottom = this._scroller.scrollHeight - this._scroller.scrollTop - this._scroller.offsetHeight;
    
    this._lockingScroll = true;
    await Promise.resolve();
    this._lockingScroll = false;
    this._scroller.scrollTop = this._scroller.scrollHeight - this._scroller.offsetHeight - scrollBottom;
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
}

export interface LogItem {
  willResizeEvent: JoelEvent<void>;
  render(): Element;
  focus(): void;
  dispose(): void;
  serializeForTest(): Promise<any>;
  waitForLineForTest?(regex: RegExp, signal?: AbortSignal): Promise<void>;
  isFullscreen?(): boolean;
  onScroll?(): void;
}
