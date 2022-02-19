import type { Shell, LogItem } from './Shell';
import './shell.css';

export class ShellView {
  private _element = document.createElement('div');
  private _fullscreenElement = document.createElement('div');
  private _removePrompt: () => void = null;
  private _lockingScroll = false;
  constructor(private _shell: Shell, private _container: HTMLElement) {
    this._updateFullscreen();
    this._fullscreenElement.classList.add('fullscreen', 'entry');
    this._shell.fullscreenEntry.on(() => this._updateFullscreen());
    this._container.appendChild(this._element);
    this._element.style.overflowY = 'auto';
    this._element.style.position = 'absolute';
    this._element.style.inset = '0';
    this._element.style.padding = '4px';
    this._repopulate();
    this._shell.activeEntry.on(entry => {
      if (this._removePrompt) {
        this._removePrompt();
        this._removePrompt = null;
      }
      if (entry)
        this._addEntry(entry);
      else
        this._addPrompt();
    });
    this._shell.clearEvent.on(() => {
      this._repopulate();
    });
  }

  _repopulate() {
    this._element.textContent = '';
    for (const entry of this._shell.log)
      this._addEntry(entry);
    if (!this._shell.activeEntry.current)
      this._addPrompt();
  }

  _updateFullscreen() {
    const fullScreenEntry = this._shell.fullscreenEntry.current;
    if (fullScreenEntry) {
      this._element.style.display = 'none';
      this._container.appendChild(this._fullscreenElement);
      this._fullscreenElement.appendChild(fullScreenEntry.element);
      document.body.classList.add('fullscreen-entry');
      fullScreenEntry.focus();
    } else {
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
    this._element.appendChild(element);
    if (logItem === this._shell.activeEntry.current)
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
    this._removePrompt = this._shell.addPrompt(this._element);
  }
}
