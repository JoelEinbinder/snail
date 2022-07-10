import type { AntiFlicker } from "./AntiFlicker";
import { host } from "./host";
import type { JoelEvent } from "./JoelEvent";

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
  constructor(
    data: string,
    shellId: number,
    private _willResizeEvent: JoelEvent<void>,
    antiFlicker?: AntiFlicker,
    ) {
    this.iframe.allowFullscreen = true;
    this.iframe.style.height = '0';
    let readyCallback;
    this.readyPromise = new Promise(resolve => {
      readyCallback = resolve;
    });
    const didDraw = antiFlicker.expectToDraw(500);
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
      }
    })
    host.sendMessage({
      method: 'urlForIFrame',
      params: {
        shellId,
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
}