import { AntiFlicker } from "./AntiFlicker";
import { font, fontString } from "./font";
import { host } from "./host";
import { JoelEvent } from "./JoelEvent";
import type { JSConnection } from "./JSConnection";
import { LogItem } from "./LogView";

const iframeMessageHandler = new Map<HTMLIFrameElement, (data: any) => void>();

window.addEventListener('message', event => {
  for (const iframe of iframeMessageHandler.keys()) {
    if (iframe.contentWindow === event.source) {
      iframeMessageHandler.get(iframe)(event.data);
    }
  }
});

const browserViewMessageHandler = new Map<number, (data: any) => void>();
host.onEvent('browserView-message', ({uuid, message}) => {
  browserViewMessageHandler.get(uuid)?.(message);
});

export type IFrameBlockDelegate = {
  connection: JSConnection;
  sendInput: (data: string) => void;
  antiFlicker?: AntiFlicker;
  socketId: number;
  browserView: boolean;
}

interface WebContentView {
  get element(): HTMLElement;
  focus(): void;
  postMessage(message: any): void;
  setHeight(height: number): void;
  setURL(url: string): void;
  dispose(): void;
  didClose(): void;
}

class BrowserView implements WebContentView {
  private _dummyElement = document.createElement('div');
  private _resizeObserver: ResizeObserver;
  private _closed = false;
  // @ts-ignore
  private _uuid = crypto.randomUUID();
  constructor(handler: (data: any) => void) {
    this._dummyElement.classList.add('browser-view-dummy');
    host.notify({ method: 'createBrowserView', params: this._uuid });
    this._resizeObserver = new ResizeObserver(() => this._updateRect());
    this._resizeObserver.observe(this._dummyElement);
    browserViewMessageHandler.set(this._uuid, handler);
  }

  focus(): void {
    host.notify({
      method: 'focusBrowserView',
      params: {uuid: this._uuid},
    });
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
}

class IFrameView implements WebContentView {
  private _iframe: HTMLIFrameElement = document.createElement('iframe');
  constructor(handler: (data: any) => void) {
    this._iframe.allowFullscreen = true;
    this._iframe.style.height = '0';
    iframeMessageHandler.set(this._iframe, handler);
  }

  focus() {
    this._iframe.focus();
  }
  postMessage(message: any) {
    this._iframe.contentWindow?.postMessage(message, '*');
  }
  setHeight(height: number) {
    this._iframe.style.height = `${height}px`;
  }
  get element(): HTMLElement {
    return this._iframe;
  }
  setURL(url: string) {
    this._iframe.src = url;
  }
  dispose() {
    iframeMessageHandler.delete(this._iframe);
  }
  didClose(): void {
  }
}

export class IFrameBlock implements LogItem {
  private _webContentView: WebContentView;
  private readyPromise: Promise<void>;
  private _closed = false;
  private _isFullscreen = false;
  public willResizeEvent = new JoelEvent<void>(undefined);
  constructor(
    data: string,
    delegate: IFrameBlockDelegate,
    ) {
    let readyCallback;
    this.readyPromise = new Promise(resolve => {
      readyCallback = resolve;
    });
    font.on(this._onFontChanged);
    const didDraw = delegate.antiFlicker.expectToDraw(500);
    const handler = data => {
      if (readyCallback) {
        readyCallback();
        readyCallback = undefined;
        return;
      }
      switch(data.method) {
        case 'setHeight': {
          this.willResizeEvent.dispatch();
          this._webContentView.setHeight(data.params.height);
          if (data.params.height > 0)
            didDraw();
          break;
        }
        case 'setIsFullscreen': {
          if (this._closed)
            return;
          const {isFullscreen} = data.params;
          this.setIsFullscreen(isFullscreen);
          if (isFullscreen) {
            didDraw();
            this._webContentView.focus();
          }
          break;
        }
        case 'sendInput': {
          delegate.sendInput(data.params);
          break;
        }
        case 'contextMenu': {
          host.sendMessage({method: 'contextMenu', params: data.params}).then(response => {
            this._webContentView.postMessage({
              method: 'contextMenuCallback',
              params: response,
            });
          });
          break;
        }
        case 'keyPressed': {
          // emit fake key press to get handled
          const event = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            ...data.params,
          });
          this._webContentView.element.dispatchEvent(event);
          if (!event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.altKey) {
            document.execCommand('insertText', false, data.params.key);
          }
          break;
        }
        case 'loadItem': {
          host.sendMessage({method: 'loadItem', params: data.params}).then(result => {
            this._webContentView.postMessage({
              result,
              id: data.id,
            });
          });
          break;
        }
        case 'saveItem': {
          host.sendMessage({method: 'saveItem', params: data.params});
          break;
        }
        case 'getDevicePixelRatio': {
          this._webContentView.postMessage({
            result: getDPR(),
            id: data.id,
          });
        }
      }
    };
    this._webContentView = delegate.browserView ? new BrowserView(handler) : new IFrameView(handler);
    host.sendMessage({
      method: 'urlForIFrame',
      params: {
        socketId: delegate.socketId,
        filePath: data,
      }
    }).then(urlStr => {
      const url = new URL(urlStr);
      url.searchParams.set('class', `${host.type()}-host`);
      url.searchParams.set('css', `--current-font: ${fontString()}`);
      if (host.type() === 'web')
        url.host = document.location.host;
      this._webContentView.setURL(url.href);
    });
    // BrowserView cannot be inline because it is absolutely positioned
    if (delegate.browserView)
      this.setIsFullscreen(true);
  }
  private setIsFullscreen(isFullscreen: boolean) {
    this._isFullscreen = isFullscreen;
    this.willResizeEvent.dispatch();
    this._webContentView.element.classList.toggle('fullscreen', isFullscreen);
  }
  render(): Element {
    return this._webContentView.element;
  }
  focus(): void {
    this._webContentView.focus();
  }
  dispose(): void {
    this._webContentView.dispose();
    font.off(this._onFontChanged);
  }
  _onFontChanged = async () => {
    await this.readyPromise;
    this._webContentView.postMessage({
      method: 'fontChanged',
      params: fontString(),
    });
  }
  async message(data: string) {
    await this.readyPromise;
    this._webContentView.postMessage({
      method: 'message',
      params: JSON.parse(data),
    });
  }

  didClose() {
    if (this._closed)
      return;
    this._closed = true;
    this._webContentView.didClose();
    if (this._isFullscreen)
      this.setIsFullscreen(false);

  }
}

const isWebKit = /WebKit/.test(navigator.userAgent);
const isChrome = /Chrome/.test(navigator.userAgent);
function getDPR() {
  if (isChrome)
    return window.devicePixelRatio;
  if (isWebKit) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('version', '1.1');
    document.body.appendChild(svg);
    const dpr = svg.currentScale * window.devicePixelRatio;
    svg.remove();
    return dpr;
  }
  return window.devicePixelRatio;
}