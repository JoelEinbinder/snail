import type { AntiFlicker } from "./AntiFlicker";
import { host } from "./host";
import type { JoelEvent } from "./JoelEvent";
import type { TerminalBlockDelegate } from "./TerminalBlock";

const iframeMessageHandler = new Map<HTMLIFrameElement, (data: any) => void>();

window.addEventListener('message', event => {
  for (const iframe of iframeMessageHandler.keys()) {
    if (iframe.contentWindow === event.source) {
      iframeMessageHandler.get(iframe)(event.data);
    }
  }
});

export class IFrameBlock {
  public iframe: HTMLIFrameElement|null = document.createElement('iframe');
  private readyPromise: Promise<void>;
  private _closed = false;
  constructor(
    data: string,
    delegate: TerminalBlockDelegate,
    private _willResizeEvent: JoelEvent<void>,
    ) {
    this.iframe.allowFullscreen = true;
    this.iframe.style.height = '0';
    let readyCallback;
    this.readyPromise = new Promise(resolve => {
      readyCallback = resolve;
    });
    const didDraw = delegate.antiFlicker.expectToDraw(500);
    iframeMessageHandler.set(this.iframe, data => {
      if (readyCallback) {
        readyCallback();
        readyCallback = undefined;
        return;
      }
      switch(data.method) {
        case 'setHeight': {
          this._willResizeEvent.dispatch();
          this.iframe.style.height = `${data.params.height}px`;
          if (data.params.height > 0)
            didDraw();
          break;
        }
        case 'setIsFullscreen': {
          if (this._closed)
            return;
          const {isFullscreen} = data.params;
          this.iframe.classList.toggle('fullscreen', isFullscreen);
          if (isFullscreen) {
            didDraw();
            this.iframe.focus();
          }
          break;
        }
        case 'keydown': {

          const ev = data.params;
          if (!ev.ctrlKey || ev.shiftKey || ev.altKey || ev.metaKey)
            break;
          const codeMap = {
            'KeyC': '\x03',
            'KeyD': '\x04',
          }
          if (ev.code in codeMap)
            delegate.sendInput(codeMap[ev.code]);
          break;
        }
      }
    })
    host.sendMessage({
      method: 'urlForIFrame',
      params: {
        shellId: delegate.shellId,
        filePath: data,
      }
    }).then(url => {
      this.iframe.src = url;
    });
  }
  async message(data: string) {
    await this.readyPromise;
    this.iframe.contentWindow.postMessage(JSON.parse(data), '*');
  }

  didClose() {
    if (this._closed)
      return;
    this._closed = true;
    if (this.iframe.classList.contains('fullscreen')) {
      this._willResizeEvent.dispatch();
      this.iframe.classList.toggle('fullscreen', false);
    }

  }
}