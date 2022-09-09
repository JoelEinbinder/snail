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

export type IFrameBlockDelegate = {
  connection: JSConnection;
  sendInput: (data: string) => void;
  antiFlicker?: AntiFlicker;
  socketId: number;
}

export class IFrameBlock implements LogItem {
  public iframe: HTMLIFrameElement|null = document.createElement('iframe');
  private readyPromise: Promise<void>;
  private _closed = false;
  private _isFullscreen = false;
  public willResizeEvent = new JoelEvent<void>(undefined);
  constructor(
    data: string,
    delegate: IFrameBlockDelegate,
    ) {
    this.iframe.allowFullscreen = true;
    this.iframe.style.height = '0';
    let readyCallback;
    this.readyPromise = new Promise(resolve => {
      readyCallback = resolve;
    });
    this.iframe.addEventListener('scroll', event => {
      if (this._isFullscreen)
        return;
      event.preventDefault();
    }, { passive: false });
    font.on(this._onFontChanged);
    const didDraw = delegate.antiFlicker.expectToDraw(500);
    iframeMessageHandler.set(this.iframe, data => {
      if (readyCallback) {
        readyCallback();
        readyCallback = undefined;
        return;
      }
      switch(data.method) {
        case 'setHeight': {
          this.willResizeEvent.dispatch();
          this.iframe.style.height = `${data.params.height}px`;
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
            this.iframe.focus();
          }
          break;
        }
        case 'sendInput': {
          delegate.sendInput(data.params);
          break;
        }
        case 'contextMenu': {
          host.sendMessage({method: 'contextMenu', params: data.params}).then(response => {
            this.iframe.contentWindow.postMessage({
              method: 'contextMenuCallback',
              params: response,
            }, '*');
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
          this.iframe.dispatchEvent(event);
          if (!event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.altKey) {
            document.execCommand('insertText', false, data.params.key);
          }
          break;
        }
        case 'loadItem': {
          host.sendMessage({method: 'loadItem', params: data.params}).then(result => {
            this.iframe.contentWindow.postMessage({
              result,
              id: data.id,
            }, '*');
          });
          break;
        }
        case 'saveItem': {
          host.sendMessage({method: 'saveItem', params: data.params});
          break;
        }
        case 'getDevicePixelRatio': {
          this.iframe.contentWindow.postMessage({
            result: getDPR(),
            id: data.id,
          }, '*');
        }
      }
    });
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
      this.iframe.src = url.href;
    });
  }
  private setIsFullscreen(isFullscreen: boolean) {
    this._isFullscreen = isFullscreen;
    this.willResizeEvent.dispatch();
    this.iframe.classList.toggle('fullscreen', isFullscreen);
  }
  render(): Element {
    return this.iframe;
  }
  focus(): void {
    this.iframe.focus();
  }
  dispose(): void {
    iframeMessageHandler.delete(this.iframe);
    font.off(this._onFontChanged);
  }
  _onFontChanged = async () => {
    await this.readyPromise;
    this.iframe.contentWindow?.postMessage({
      method: 'fontChanged',
      params: fontString(),
    }, '*');
  }
  async message(data: string) {
    await this.readyPromise;
    this.iframe.contentWindow.postMessage({
      method: 'message',
      params: JSON.parse(data),
    }, '*');
  }

  didClose() {
    if (this._closed)
      return;
    this._closed = true;
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