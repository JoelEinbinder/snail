import type { JoelEvent } from './JoelEvent';
import type { Shell } from './Shell';
import './shell.css';
import './logView.css';

export class LogView {
  private _element = document.createElement('div');
  private _fullscreenElement = document.createElement('div');
  private _promptElement: HTMLElement;
  private _lockingScroll = false;
  private _undoFullscreen: () => void = null;
  constructor(private _shell: Shell, private _container: HTMLElement) {
    this._updateFullscreen();
    this._fullscreenElement.classList.add('fullscreen-element');
    this._shell.fullscreenItem.on(() => this._updateFullscreen());
    this._container.appendChild(this._element);
    this._container.addEventListener('keydown', e => {
      if (!this._promptElement)
        return;
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey)
        return;
      const element = e.target as HTMLElement;
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' || element.isContentEditable)
        return;
      if (e.defaultPrevented)
        return;
      this._promptElement.focus();
    })
    this._scroller.classList.toggle('log-view-scroller', true);
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
    this._element.classList.add('content');
  }

  _repopulate() {
    if (this._promptElement) {
      this._promptElement.remove();
      this._promptElement = null;
    }
    this._element.textContent = '';
    for (const entry of this._shell.log)
      this._addEntry(entry);
    if (this._shell.promptLock.current === 0)
      this._addPrompt();
  }

  _updateFullscreen() {
    const fullScreenEntry = this._shell.fullscreenItem.current;
    if (fullScreenEntry) {
      this._element.classList.add('inert');
      const placeholder = document.createElement('div');
      const element = fullScreenEntry.render();
      element.parentElement.replaceChild(placeholder, element);
      this._container.appendChild(this._fullscreenElement);
      this._fullscreenElement.appendChild(element);
      document.body.classList.add('fullscreen-entry');
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
      this._element.classList.remove('inert');
      document.body.classList.remove('fullscreen-entry');
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
      this._element.insertBefore(element, this._promptElement);
    else
      this._element.appendChild(element);
    if (logItem === this._shell.activeItem.current)
      logItem.focus();
  }

  private get _scroller() {
    // vscode needs this to be the element for scroll locking to work
    // webkit needs this to be the body for scrollbars to be white
    return navigator.userAgent.includes('Chrome') ? this._element : this._container;
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
    this._promptElement = this._shell.addPrompt(this._element, () => this._lockScroll());
  }
}

export interface LogItem {
  willResizeEvent: JoelEvent<void>;
  render(): Element;
  focus(): void;
  dispose(): void;
}
