import { AntiFlicker } from "./AntiFlicker";
import { font, fontString } from "./font";
import { host } from "./host";
import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
import type { JSConnection } from "./JSConnection";
import { LogItem } from "./LogItem";
import { cdpManager, DebuggingInfo } from './CDPManager';
import { expectingUserInput, startAyncWork } from "./async";
import type { FindParams } from "./Find";
import { getCurrentShortcutActions } from "./actions";
import type { Action } from './actions';
import { BrowserView } from "./BrowserView";
import { attachMenuItemsToContextMenuEvent } from "./contextMenu";

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
  urlForIframe(filePath: string): Promise<string>;
  browserView: boolean;
  tryToRunCommand(command: string): void;
}

export interface WebContentView {
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

class IFrameView implements WebContentView {
  private _iframe: HTMLIFrameElement = document.createElement('iframe');
  // @ts-ignore
  private _uuid: string = String(Math.random());
  constructor(handler: (data: any) => void) {
    this._iframe.allowFullscreen = true;
    this._iframe.style.height = '0';
    this._iframe.name = this._uuid;
    this._iframe.allow = 'clipboard-write';
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
  private _findParams: FindParams|null = null;
  // When the window blurs, our iframe or browserview might have focus.
  // Update the shortcuts to make sure they come back to us from the web content.
  private _onWindowBlur = () => this._updateShortcuts();
  private _doneLoading: () => void;
  constructor(
    data: string,
    delegate: IFrameBlockDelegate,
    ) {
    this._resetReadyPromise();
    // TODO reset ready promise and wait for new signal on refresh
    font.on(this._onFontChanged);
    window.addEventListener('blur', this._onWindowBlur);
    const didDraw = delegate.antiFlicker.expectToDraw(500);
    const handler = data => {
      if (data === 'ready') {
        this._readyCallback();
        this._updateShortcuts();
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
        case 'close': {
          this.didClose();
          this._webContentView.element.remove();
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
          const { noDefaultItems, menuItems }: { noDefaultItems?: boolean, menuItems: any[]} = data.params;
          if (noDefaultItems) {
            host.sendMessage({method: 'contextMenu', params: data.params}).then(response => {
              this._webContentView.postMessage({
                method: 'contextMenuCallback',
                params: response,
              });
            });
          } else {
            const event = new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
            });
            attachMenuItemsToContextMenuEvent(menuItems.map(item => ({
              ...item,
              callback: () => {
                this._webContentView.postMessage({
                  method: 'contextMenuCallback',
                  params: { id: item.callback, data: null },
                });
              }
            })), event);
            this._webContentView.element.dispatchEvent(event);
          }
          break;
        }
        case 'chordPressed': {
          // emit fake key press to get handled
          this._webContentView.element.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'b',
            code: 'KeyB',
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
        case 'tryToRunCommand': {
          const { command } = data.params;
          delegate.tryToRunCommand(command);
          break;
        }
        case 'reportFindMatches': {
          const { matches } = data.params;
          this._findParams?.report(matches);
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
  setFind(params: FindParams|null): void {
    this._findParams = params;
    this._webContentView.postMessage({
      method: 'setFind',
      params: params ? { regex: { source: params.regex.source, flags: params.regex.flags } } : null,
    });
  }

  private _resetReadyPromise() {
    this._doneLoading?.();
    this.readyPromise = new Promise(resolve => {
      this._readyCallback = resolve;
    });
    this._doneLoading = startAyncWork('iframe loading');
    this.readyPromise.then(this._doneLoading);
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
    window.removeEventListener('blur', this._onWindowBlur);
    this._detachCDPIfNeeded();
    this._cleanupAsyncWorkIfNeeded();
  }
  _cleanupAsyncWorkIfNeeded() {
    this._doneLoading?.();
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
  async message(data: string, dontCache?: boolean) {
    const message = {
      method: 'message',
      params: JSON.parse(data),
    };
    if (!dontCache)
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
    if (this._isFullscreen) {
      this.setIsFullscreen(false);
      if (this._lastHeight === 0)
        this._webContentView.element.remove();
    }
  
    const message = {
      method: 'didClose',
    };
    this._cachedMessages.push(message);
    this.readyPromise.then(() => this._webContentView.postMessage(message));
  }

  debugginInfo() {
    return this._webContentView.debuggingInfo;
  }

  async refresh() {
    const cachedMessages = [...this._cachedMessages];
    this._cleanupAsyncWorkIfNeeded();
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

  _updateShortcuts() {
    this._webContentView.postMessage({
      method: 'setActiveShortcuts',
      params: getCurrentShortcutActions().map(x => x.shortcut),
    });
  }
  async aysncActions(): Promise<Action[]> {
    if (!this._webContentView.element.isConnected)
      return [];
    const id = ++this._lastMessageId;
    const {actions} = await new Promise<any>(resolve => {
      this._messageCallbacks.set(id, resolve);
      this._webContentView.postMessage({id, method: 'requestActions'});
    });
    for (const action of actions) {
      const callbackId = action.callback;
      action.callback = () => {
        this._webContentView.postMessage({method: 'runAction', params: callbackId});
      };
    }
    return actions;
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