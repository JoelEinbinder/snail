import { JoelEvent } from "./JoelEvent";
import type { LogItem } from "./LogView";

export class JSBlock implements LogItem {
  willResizeEvent = new JoelEvent(undefined);
  private _element: HTMLElement;
  constructor() {
    this._element = document.createElement('div');
    this._element.className = 'js-block';
    this._element.textContent = 'JSBlock';
  }
  render(): Element {
    return this._element;
  }
  focus(): void {
  }
  dispose(): void {
  }  
}
