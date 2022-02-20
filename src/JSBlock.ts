import { JoelEvent } from "./JoelEvent";
import { JSConnection } from "./JSConnection";
import type { LogItem } from "./LogView";
import { Protocol } from "./protocol";

export class JSBlock implements LogItem {
  willResizeEvent = new JoelEvent(undefined);
  private _element: HTMLElement;
  constructor(object: Protocol.Runtime.RemoteObject, private _connection: JSConnection) {
    this._element = document.createElement('div');
    this._element.className = 'js-block';
    this._element.textContent = object.description;
    console.log(object);
  }
  render(): Element {
    return this._element;
  }
  focus(): void {
  }
  dispose(): void {
  }  
}
