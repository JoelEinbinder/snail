import { AntiFlicker } from "./AntiFlicker";
import { host } from "./host";
import { JoelEvent } from "./JoelEvent";
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
  shellId: number;
  sendInput: (data: string) => void;
  antiFlicker?: AntiFlicker;
}

export class IFrameBlock implements LogItem {
  public iframe: HTMLIFrameElement|null = document.createElement('iframe');
  private readyPromise: Promise<void>;
  private _closed = false;
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