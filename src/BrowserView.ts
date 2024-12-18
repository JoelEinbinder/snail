import { host } from "./host";
import type { WebContentView } from "./IFrameBlock";
import { randomUUID } from "./uuid";
import type { DebuggingInfo } from './CDPManager';

const browserViewMessageHandler = new Map<string, (data: any, trusted: boolean) => void>();
host.onEvent('browserView-message', ({uuid, message, trusted}) => {
  browserViewMessageHandler.get(uuid)?.(message, !!trusted);
});

let cachedBrowserView: {url: string, uuid:string}|null = null;
function getOrCreateBrowserView(url: string|undefined) {
  if (cachedBrowserView) {
    const {uuid, url: cachedURL} = cachedBrowserView;
    if (!browserViewsHidden)
      host.notify({ method: 'showBrowserView', params: { uuid } });
    cachedBrowserView = null;
    if (cachedURL && cachedURL === url) {
      host.notify({
        method: 'postBrowserViewMessage',
        params: {uuid, message: {
          method: 'adopted',
        }},
      });
    } else if (url) {
      host.notify({
        method: 'setBrowserViewURL',
        params: {uuid, url},
      });
    } else {
      
    }
    return uuid;
  }
  const uuid = randomUUID();
  host.notify({ method: 'createBrowserView', params: uuid });
  if (browserViewsHidden)
    host.notify({ method: 'hideBrowserView', params: { uuid: uuid } });
  if (url) {
    host.notify({
      method: 'setBrowserViewURL',
      params: {uuid, url},
    });
  }
  return uuid;
}

function destroyBrowserView(uuid: string) {
  host.notify({
    method: 'destroyBrowserView',
    params: {uuid},
  });
}

function returnBrowserView({uuid, url}: {uuid: string, url: string}) {
  if (cachedBrowserView)
    destroyBrowserView(cachedBrowserView.uuid);
  cachedBrowserView = {uuid, url};
  host.notify({ method: 'hideBrowserView', params: { uuid } });
}

export class BrowserView implements WebContentView {
  private _dummyElement = document.createElement('div');
  private _resizeObserver: ResizeObserver;
  private _closed = false;
  private _uuid: string;
  private _url = 'about:blank';
  constructor(url: string|undefined, handler: (data: any, trusted: boolean) => void) {
    this._dummyElement.classList.add('browser-view-dummy');
    this._dummyElement.tabIndex = 0;
    if (url)
      this._url = url;
    this._uuid = getOrCreateBrowserView(url);
    this._resizeObserver = new ResizeObserver(() => this._updateRect());
    this._resizeObserver.observe(this._dummyElement);
    browserViewMessageHandler.set(this._uuid, handler);
    this._dummyElement.addEventListener('focus', () => {
      host.notify({
        method: 'focusBrowserView',
        params: {uuid: this._uuid},
      });
    });
  }

  focus(): void {
    this._dummyElement.focus();
  }

  dispose(): void {
    this.didClose();
  }
  didClose(): void {
    if (this._closed)
      return;
    this._closed = true;
    this._resizeObserver.disconnect();
    browserViewMessageHandler.delete(this._uuid);
    returnBrowserView({uuid: this._uuid, url: this._url});
  }

  get element(): HTMLElement {
    return this._dummyElement;
  }

  postMessage(message: any): void {
    host.notify({
      method: 'postBrowserViewMessage',
      params: {uuid: this._uuid, message},
    });
  }

  setHeight(height: number): void {
    // no op. BrowserView must be fullscreen
  }

  _updateRect() {
    const rect = this._dummyElement.getBoundingClientRect();
    host.notify({
      method: 'setBrowserViewRect',
      params: {
        uuid: this._uuid,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        }
      },
    });
  }

  setURL(url: string): void {
    this._url = url;
    host.notify({
      method: 'setBrowserViewURL',
      params: {uuid: this._uuid, url},
    });
  }

  refresh() {
    host.notify({
      method: 'refreshBrowserView',
      params: {uuid: this._uuid},
    });
  }

  goBack() {
    host.notify({
      method: 'backBrowserView',
      params: {uuid: this._uuid},
    });
  }

  goForward() {
    host.notify({
      method: 'forwardBrowserView',
      params: {uuid: this._uuid},
    });
  }


  requestInspect() {
    host.notify({
      method: 'requestInspect',
      params: {uuid: this._uuid}
    })
  }

  get debuggingInfo(): DebuggingInfo {
    return {
      browserViewUUID: this._uuid,
      type: host.type() === 'webkit' ? 'webkit' : 'chromium',
    }
  }
}

let browserViewsHidden = false;
export function setBrowserViewsHidden(hidden: boolean) {
  if (hidden === browserViewsHidden)
    return;
  browserViewsHidden = hidden;
  if (hidden) {
    for (const uuid of browserViewMessageHandler.keys())
      host.notify({ method: 'hideBrowserView', params: { uuid } });
  } else {
    for (const uuid of browserViewMessageHandler.keys())
      host.notify({ method: 'showBrowserView', params: { uuid } });
  }
}