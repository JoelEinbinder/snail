import { AntiFlicker } from "./AntiFlicker";
import { font, fontString } from "./font";
import { host } from "./host";
import { JoelEvent } from "./JoelEvent";
import type { JSConnection } from "./JSConnection";
import { LogItem } from "./LogView";
import { cdpManager, DebuggingInfo } from './CDPManager';
import { randomUUID } from "./uuid";
import { expectingUserInput, startAyncWork } from "./async";

const iframeMessageHandler = new Map<HTMLIFrameElement, (data: any) => void>();

window.addEventListener('message', event => {
  for (const iframe of iframeMessageHandler.keys()) {
    if (iframe.contentWindow === event.source) {
      iframeMessageHandler.get(iframe)(event.data);
    }
  }
});

const browserViewMessageHandler = new Map<string, (data: any) => void>();
host.onEvent('browserView-message', ({uuid, message}) => {
  browserViewMessageHandler.get(uuid)?.(message);
});

export type IFrameBlockDelegate = {
  connection: JSConnection;
  sendInput: (data: string) => void;
  antiFlicker?: AntiFlicker;
  urlForIframe(filePath: string): Promise<string>;
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
  refresh(): void;
  requestInspect(): void;
  get debuggingInfo(): DebuggingInfo;
}

class BrowserView implements WebContentView {
  private _dummyElement = document.createElement('div');
  private _resizeObserver: ResizeObserver;
  private _closed = false;
  // @ts-ignore
  private _uuid: string = randomUUID();
  constructor(handler: (data: any) => void) {
    this._dummyElement.classList.add('browser-view-dummy');
    this._dummyElement.tabIndex = 0;
    host.notify({ method: 'createBrowserView', params: this._uuid });
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

class IFrameView implements WebContentView {
  private _iframe: HTMLIFrameElement = document.createElement('iframe');
  // @ts-ignore
  private _uuid: string = String(Math.random());
  constructor(handler: (data: any) => void) {
    this._iframe.allowFullscreen = true;
    this._iframe.style.height = '0';
    this._iframe.name = this._uuid;
    iframeMessageHandler.set(this._iframe, handler);
  }

  focus() {
    // This will focus the body in the iframe, so try not to disturb things if there is already focus.
    if (this._iframe.ownerDocument.activeElement === this._iframe)
      return;
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
  refresh() {
    this._iframe.src = this._iframe.src;
  }
  get debuggingInfo(): DebuggingInfo {
    return {
      frameUUID: this._uuid,
      type: host.type() === 'webkit' ? 'webkit' : 'chromium',
    }
  }
  requestInspect() {
    host.notify({
      method: 'requestInspect',
      params: {},
    })
  }
}

export class IFrameBlock implements LogItem {
  private _webContentView: WebContentView;
  private readyPromise: Promise<void>;
  private _closed = false;
  private _isFullscreen = false;
  private _attachedToCDP = false;
  public willResizeEvent = new JoelEvent<void>(undefined);
  private _cachedMessages: any[] = [];
  private _readyCallback: () => void;
  private _messageCallbacks = new Map<number, ((result: any) => void)>();
  private _lastMessageId = 0;
  private _finishWorks = new Map<number, () => void>();
  private _resolveUserInputs = new Map<number, () => void>();
  private _lastHeight = 0;
  constructor(
    data: string,
    delegate: IFrameBlockDelegate,
    ) {
    this._resetReadyPromise();
    // TODO reset ready promise and wait for new signal on refresh
    font.on(this._onFontChanged);
    const didDraw = delegate.antiFlicker.expectToDraw(500);
    const handler = data => {
      if (data === 'ready') {
        this._readyCallback();
        return;
      }
      if (!data.method && data.id)
        this._messageCallbacks.get(data.id)(data.result);
      switch(data.method) {
        case 'setHeight': {
          this.willResizeEvent.dispatch();
          this._lastHeight = data.params.height;
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
        case 'chordPressed': {
          // emit fake key press to get handled
          this._webContentView.element.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'a',
            code: 'KeyA',
            ctrlKey: true,
          }));
          this._webContentView.element.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            ...data.params,
          }));
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
          host.notify({method: 'saveItem', params: data.params});
          break;
        }
        case 'getDevicePixelRatio': {
          this._webContentView.postMessage({
            result: getDPR(),
            id: data.id,
          });
          break;
        }
        case 'requestCDP': {
          this._attachedToCDP = true;
          cdpManager.attachCDPListener({
            onMessage: (message, browserViewUUID) => {
              this._webContentView.postMessage({method: 'cdpMessage', params: {message, browserViewUUID}});
            },
            updateDebuggees: (debuggees) => {
              const myInfo = this.debugginInfo();
              // prevent debugging myself by filtering out anything from this iframe block
              for (const key in debuggees) {
                if (debuggees[key].frameUUID === myInfo.frameUUID && debuggees[key].browserViewUUID === myInfo.browserViewUUID)
                  delete debuggees[key];
              }
              this._webContentView.postMessage({method: 'updateDebugees', params: debuggees});
            }
          });
          break;
        }
        case 'requestInspect': {
          this._webContentView.requestInspect();
          break;
        }
        case 'cdpMessage': {
          cdpManager.sendMessage(data.params.message, data.params.browserViewUUID);
          break;
        }
        case 'did-navigate': {
          this._detachCDPIfNeeded();
          break;
        }
        case 'startAsyncWork': {
          if (this._finishWorks.has(data.params.id))
            throw new Error('Work already started');
          this._finishWorks.set(data.params.id, startAyncWork(data.params.name));
          break;
        }
        case 'finishWork': {
          const finishWork = this._finishWorks.get(data.params.id);
          this._finishWorks.delete(data.params.id);
          finishWork();
          break;
        }
        case 'expectingUserInput': {
          if (this._resolveUserInputs.has(data.params.id))
            throw new Error('Already expecting user input');
          this._resolveUserInputs.set(data.params.id, expectingUserInput(data.params.name));
          break;
        }
        case 'resolveUserInput': {
          const resolve = this._resolveUserInputs.get(data.params.id);
          this._resolveUserInputs.delete(data.params.id);
          resolve();
          break;
        }
      }
    };
    this._webContentView = delegate.browserView ? new BrowserView(handler) : new IFrameView(handler);
    delegate.urlForIframe(data).then(urlStr => {
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

  private _resetReadyPromise() {
    this.readyPromise = new Promise(resolve => {
      this._readyCallback = resolve;
    });
    this.readyPromise.then(startAyncWork('iframe loading'));
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
    this._detachCDPIfNeeded();
    this._cleanupAsyncWorkIfNeeded();
  }
  _cleanupAsyncWorkIfNeeded() {
    for (const finish of this._finishWorks.values())
      finish();
    this._finishWorks.clear();
    for (const resolve of this._resolveUserInputs.values())
      resolve();
    this._resolveUserInputs.clear();
  }
  _detachCDPIfNeeded() {
    if (!this._attachedToCDP)
      return;
    this._attachedToCDP = false;
    cdpManager.detachCDPListener();
  }
  _onFontChanged = async () => {
    await this.readyPromise;
    this._webContentView.postMessage({
      method: 'fontChanged',
      params: fontString(),
    });
  }
  async message(data: string) {
    const message = {
      method: 'message',
      params: JSON.parse(data),
    };
    this._cachedMessages.push(message);
    await this.readyPromise;
    this._webContentView.postMessage(message);
  }

  didClose() {
    if (this._closed)
      return;
    this._detachCDPIfNeeded();
    this._cleanupAsyncWorkIfNeeded();
    this._closed = true;
    this._webContentView.didClose();
    if (this._isFullscreen)
      this.setIsFullscreen(false);

  }

  debugginInfo() {
    return this._webContentView.debuggingInfo;
  }

  async refresh() {
    const cachedMessages = [...this._cachedMessages];
    this._resetReadyPromise();
    this._webContentView.refresh();
    await this.readyPromise;
    for (const message of cachedMessages)
      this._webContentView.postMessage(message);
  }

  async serializeForTest(): Promise<any> {
    if (this._lastHeight === 0 && !this._isFullscreen)
      return null;
    const id = ++this._lastMessageId;
    const {json} = await new Promise<any>(resolve => {
      this._messageCallbacks.set(id, resolve);
      this._webContentView.postMessage({id, method: 'requestJSON'});
    });
    this._messageCallbacks.delete(id);
    return json || '<iframe>';
  }

  isFullscreen(): boolean {
    return this._isFullscreen;
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