import { host } from "./host";
import { JoelEvent } from "./JoelEvent";
import { LogItem } from "./LogView";
import type { TerminalBlockDelegate } from "./TerminalBlock";

const iframeMessageHandler = new Map<HTMLIFrameElement, (data: any) => void>();

window.addEventListener('message', event => {
  for (const iframe of iframeMessageHandler.keys()) {
    if (iframe.contentWindow === event.source) {
      iframeMessageHandler.get(iframe)(event.data);
    }
  }
});

export class IFrameBlock implements LogItem {
  public iframe: HTMLIFrameElement|null = document.createElement('iframe');
  private readyPromise: Promise<void>;
  private _closed = false;
  public willResizeEvent = new JoelEvent<void>(undefined);
  constructor(
    data: string,
    delegate: TerminalBlockDelegate,
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
          this.iframe.classList.toggle('fullscreen', isFullscreen);
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
        }
      }
    });
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
  render(): Element {
    return this.iframe;
  }
  focus(): void {
    this.iframe.focus();
  }
  dispose(): void {
    iframeMessageHandler.delete(this.iframe);
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
    if (this.iframe.classList.contains('fullscreen')) {
      this.willResizeEvent.dispatch();
      this.iframe.classList.toggle('fullscreen', false);
    }

  }
}