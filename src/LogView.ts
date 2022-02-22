import type { JoelEvent } from './JoelEvent';
import type { Shell } from './Shell';
import './shell.css';

export class LogView {
  private _element = document.createElement('div');
  private _fullscreenElement = document.createElement('div');
  private _promptElement: Element;
  private _lockingScroll = false;
  private _undoFullscreen: () => void = null;
  constructor(private _shell: Shell, private _container: HTMLElement) {
    this._updateFullscreen();
    this._fullscreenElement.classList.add('fullscreen', 'entry');
    this._shell.fullscreenItem.on(() => this._updateFullscreen());
    this._container.appendChild(this._element);
    this._element.style.overflowY = 'auto';
    this._element.style.position = 'absolute';
    this._element.style.inset = '0';
    this._element.style.padding = '4px';
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
      this._element.style.display = 'none';
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
      this._element.style.display = 'block';
      document.body.classList.remove('fullscreen-entry');
    }
  }

  _addEntry(logItem: LogItem) {
    const element = logItem.render();
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

  async _lockScroll() {
    if (this._lockingScroll)
      return;
    const scrollBottom = this._element.scrollHeight - this._element.scrollTop - this._element.offsetHeight;
    
    this._lockingScroll = true;
    await Promise.resolve();
    this._lockingScroll = false;
    this._element.scrollTop = this._element.scrollHeight - this._element.offsetHeight - scrollBottom;
  }

  _addPrompt() {
    this._lockScroll();
    this._promptElement = this._shell.addPrompt(this._element);
  }
}

export interface LogItem {
  willResizeEvent: JoelEvent<void>;
  render(): Element;
  focus(): void;
  dispose(): void;
}
