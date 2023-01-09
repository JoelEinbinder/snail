import type { JoelEvent } from './JoelEvent';
import type { Shell } from './Shell';
import './shell.css';
import './logView.css';
import { Block, BlockDelegate } from './GridPane';

export class LogView implements Block {
  private _element = document.createElement('div');
  private _scroller = document.createElement('div');
  private _fullscreenElement = document.createElement('div');
  private _promptElement: HTMLElement;
  private _lockingScroll = false;
  private _undoFullscreen: () => void = null;
  private _removeListeners: () => void;
  blockDelegate?: BlockDelegate;
  constructor(private _shell: Shell, private _container: HTMLElement) {
    this._updateFullscreen();
    this._fullscreenElement.classList.add('fullscreen-element');
    this._shell.fullscreenItem.on(() => this._updateFullscreen());
    this._shell.setDelegate({
      onClose: () => this._dispose(),
    });
    this._removeListeners = () => {
      document.body.removeEventListener('keydown', keyDownListener, false);
    };
    const keyDownListener = (event: KeyboardEvent) => {
      if (!this._promptElement)
        return;
      if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey)
        return;
      const element = event.target as HTMLElement;
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' || element.isContentEditable)
        return;
      if (event.defaultPrevented)
        return;
      this._promptElement.focus();
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
          this._shell.toggleDaemon();
          event.preventDefault();
          event.stopImmediatePropagation();
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
    this._repopulate();
    this._shell.activeItem.on(item => {
      if (item)
        item.focus();
    });
    this._shell.promptLock.on(count => {
      if (count > 0) {
        if (this._promptElement) {
          this._promptElement.remove();
          this._promptElement = null;
        }
      } else {
        this._addPrompt();
      }
    });
    this._shell.addItemEvent.on(item => {
      this._addEntry(item);
    });
    this._shell.clearEvent.on(() => {
      this._repopulate();
    });
  }
  focus(): void {
    if (this._promptElement)
      this._promptElement.focus();
    else if (this._shell.activeItem.current)
      this._shell.activeItem.current.focus();
  }
  hasFocus(): boolean {
    return this._element.contains(document.activeElement);
  }

  _dispose() {
    this._removeListeners();
    this.blockDelegate.close();
    this._element.remove();
  }

  async _doSplit(direction: 'horizontal' | 'vertical') {
    const shell = await (await import('./Shell')).Shell.create();
    this.blockDelegate.split(new LogView(shell, this._container), direction);
  }

  updatePosition(rect: { x: number; y: number; width: number; height: number; }): void {
    this._lockScroll();
    this._element.style.left = rect.x + 'px';
    this._element.style.top = rect.y + 'px';
    this._element.style.width = rect.width + 'px';
    this._element.style.height = rect.height + 'px';
    this._shell.updateSize(rect.width, rect.height);
  }

  _repopulate() {
    if (this._promptElement) {
      this._promptElement.remove();
      this._promptElement = null;
    }
    this._scroller.textContent = '';
    for (const entry of this._shell.log)
      this._addEntry(entry);
    if (this._shell.promptLock.current === 0)
      this._addPrompt();
  }

  _updateFullscreen() {
    const fullScreenEntry = this._shell.fullscreenItem.current;
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
    logItem.willResizeEvent.on(async () => {
      this._lockScroll();
    });
    this._lockScroll();
    if (this._promptElement)
      this._scroller.insertBefore(element, this._promptElement);
    else
      this._scroller.appendChild(element);
    if (logItem === this._shell.activeItem.current)
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
    this._promptElement = this._shell.addPrompt(this._scroller, () => this._lockScroll());
  }
}

export interface LogItem {
  willResizeEvent: JoelEvent<void>;
  render(): Element;
  focus(): void;
  dispose(): void;
}
