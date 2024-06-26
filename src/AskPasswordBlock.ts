import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
import type { LogItem } from "./LogItem";
import './AskPasswordBlock.css';
import { expectingUserInput } from './async';
import type { FindParams } from "./Find";

export class AskPasswordBlock implements LogItem {
  private _element = document.createElement('div');
  private _input = document.createElement('input');
  willResizeEvent = new JoelEvent<void>(undefined);
  private _resolveUserInput = expectingUserInput('ask password');
  constructor(private _message: string, callback: (password: string) => void) {
    this._element.classList.add('ask-password');
    this._input.type = /password/i.test(this._message) ?  'password' : 'text';
    const messageElement = document.createElement('span');
    messageElement.textContent = this._message;
    this._element.append(messageElement, this._input);
    this._input.addEventListener('keydown', event => {
      if (event.key !== 'Enter')
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      callback(this._input.value);
      this._input.replaceWith(this._input.type === 'password' ? '<password>' : this._input.value);
      this._resolveUserInput();
    });
  }
  render(): Element {
    return this._element;
  }
  focus(): void {
    this._input.focus();
  }
  dispose(): void {
    this._resolveUserInput();
  }
  async serializeForTest(): Promise<any> {
    return { message: this._message, input: this._input.isConnected ? this._input.value : this._element.childNodes[1].textContent };
  }
  async waitForLineForTest(regex: RegExp, signal?: AbortSignal): Promise<void> {
    if (regex.test(this._message))
      return;
    // wait forever because there is no match and we never update
    return new Promise(x => {});
  }

  setFind(params: FindParams): void {
  }
}