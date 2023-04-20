import { host } from "./host";
import type { WebContentView } from "./IFrameBlock";
import { randomUUID } from "./uuid";
import type { DebuggingInfo } from './CDPManager';

const browserViewMessageHandler = new Map<string, (data: any) => void>();
host.onEvent('browserView-message', ({uuid, message}) => {
  browserViewMessageHandler.get(uuid)?.(message);
});
export class BrowserView implements WebContentView {
  private _dummyElement = document.createElement('div');
  private _resizeObserver: ResizeObserver;
  private _closed = false;
  // @ts-ignore
  private _uuid: string = randomUUID();
  constructor(handler: (data: any) => void) {
    this._dummyElement.classList.add('browser-view-dummy');
    this._dummyElement.tabIndex = 0;
    host.notify({ method: 'createBrowserView', params: this._uuid });
    if (browserViewsHidden)
      host.notify({ method: 'hideBrowserView', params: { uuid: this._uuid } });
    this._resizeObserver = new ResizeObserver(() => this._updateRect());
    this._resizeObserver.observe(this._dummyElement);
    browserViewMessageHandler.set(this._uuid, handler);
    this._dummyElement.addEventListener('focus', () => [
      host.notify({
        method: 'focusBrowserView',
        params: {uuid: this._uuid},
      })  
    ]);
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
    host.notify({
      method: 'destroyBrowserView',
      params: {uuid: this._uuid},
    });
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