import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
import { BrowserView } from "./BrowserView";
import { FindParams } from "./Find";
import type { LogItem } from "./LogItem";
import './browserShell.css';

export class BrowserShell implements LogItem {
  private _element = document.createElement('div');
  willResizeEvent = new JoelEvent<void>(undefined);
  titleChangedEvent = new JoelEvent<string|null>(null);
  private _isFullscreen = false;
  private _view: BrowserView;
  removeSelf?: () => void;
  constructor(url: string, onClose: () => void) {
    this._element.classList.add('browser-shell');
    const navbar = document.createElement('div');
    navbar.classList.add('navbar');
    this._element.appendChild(navbar);
    const backButton = document.createElement('button');
    backButton.title = 'Back';
    backButton.classList.add('back');
    backButton.disabled = true;
    backButton.addEventListener('click', () => {
      this._view.goBack();
    });
    navbar.appendChild(backButton);
    const forwardButton = document.createElement('button');
    forwardButton.title = 'Forward';
    forwardButton.classList.add('forward');
    forwardButton.disabled = true;
    forwardButton.addEventListener('click', () => {
      this._view.goForward();
    });
    navbar.appendChild(forwardButton);
    const reloadButton = document.createElement('button');
    reloadButton.title = 'Reload';
    reloadButton.classList.add('reload');
    reloadButton.addEventListener('click', () => {
      this._view.refresh();
    });
    navbar.appendChild(reloadButton);
    const addressBar = document.createElement('input');
    addressBar.type = 'text';
    addressBar.value = url;
    addressBar.onblur = () => {
      addressBar.replaceWith(domainBar);
    };
    addressBar.addEventListener('change', () => {
      url = addressBar.value;
      this._view.setURL(url);
    });
    const domainBar = document.createElement('div');
    domainBar.classList.add('domain');
    domainBar.textContent = 'domain';
    domainBar.tabIndex = 0;
    domainBar.onfocus = () => {
      domainBar.replaceWith(addressBar);
      addressBar.focus();
      addressBar.select();
    }
    navbar.appendChild(domainBar);

    const closeButton = document.createElement('button');
    closeButton.title = 'Close';
    closeButton.classList.add('close');
    const close = () => {
      this.setIsFullscreen(false);
      this.removeSelf();
      onClose();
    };
    closeButton.addEventListener('click', close);
    navbar.appendChild(closeButton);
    navbar.addEventListener('keydown', event => {
      if (event.defaultPrevented)
        return;
      if (event.code === 'KeyC' && event.ctrlKey) {
        event.preventDefault();
        close();
      }
    })

    this._view = new BrowserView(url, (data, trusted) => {
      if (!trusted)
        return;
      const {method, params} = data;
      if (method === 'did-navigate') {
        addressBar.value = params.url;
        domainBar.textContent = new URL(params.url).hostname;
        backButton.disabled = !params.canGoBack;
        forwardButton.disabled = !params.canGoForward;
      } else if (method === 'page-title-updated') {
        this.titleChangedEvent.dispatch(params.title);
      } else if (method === 'input-event') {
        const {type, code, control} = params;
        if (type !== 'rawKeyDown' || !control || code !== 'KeyC')
          return;
        close();
      } else {
        console.log(data);
      }
    });
    this._element.append(this._view.element);

    this.titleChangedEvent.dispatch(url);

  }
  setIsFullscreen(isFullscreen: boolean): void {
    this._isFullscreen = isFullscreen;
    this._element.classList.toggle('fullscreen', isFullscreen);
    this.willResizeEvent.dispatch();
  }
  isFullscreen(): boolean {
    return this._isFullscreen;
  }
  render(): Element {
    return this._element;
  }
  focus(): void {
    this._element.focus();
  }
  dispose(): void {
  }
  async serializeForTest(){
    return '<browser block>';
  }
  setFind(params: FindParams): void {
  }
}