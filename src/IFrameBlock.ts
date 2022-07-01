import type { JoelEvent } from "./JoelEvent";

const iframeMessageHandler = new Map<HTMLIFrameElement, (data: any) => void>();

window.onmessage = event => {
  for (const iframe of iframeMessageHandler.keys()) {
    if (iframe.contentWindow === event.source) {
      iframeMessageHandler.get(iframe)(event.data);
    }
  }
}

export class IFrameBlock {
  public iframe: HTMLIFrameElement|null = document.createElement('iframe');
  private readyPromise: Promise<void>;
  constructor(
    data: string,
    shellId: number,
    private _willResizeEvent: JoelEvent<void>,
    ) {
    this.iframe.allowFullscreen = true;
    this.iframe.style.height = '0';
    let readyCallback;
    this.readyPromise = new Promise(resolve => {
      readyCallback = resolve;
    });
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
          break;
        }
      }
    })
    const url = new URL(`d4://${shellId}.fake`);
    url.pathname = data;
    this.iframe.src = url.href;
  }
  async message(data: string) {
    await this.readyPromise;
    this.iframe.contentWindow.postMessage(JSON.parse(data), '*');
  }
}