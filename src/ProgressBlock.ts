import { host } from "./host";
import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
import type { LogItem } from "./LogItem";
import './progressBlock.css';
import type { FindParams } from "./Find";

export class ProgressBlock implements LogItem {
  willResizeEvent = new JoelEvent<void>(undefined);
  private _element = document.createElement('div');
  private _leftText = document.createElement('div');
  private _progress = document.createElement('progress');
  private _rightText = document.createElement('div');
  private _closed = false;
  constructor() {
    this._element.classList.add('progress-block');
    this._progress.max = 1;
    this._element.append(this._leftText, this._progress, this._rightText);
  }
  setFind(params: FindParams): void {
  }
  async serializeForTest() {
    return (this._element.isConnected && this._element.classList.contains('visible')) ? {
      type: 'progress',
      left: this._leftText.textContent || undefined,
      value: this._progress.value,
      right: this._rightText.textContent || undefined,
    } : null;
  }
  dispose(): void {
      
  }
  focus(): void {
      // unimplemented
  }
  render(): Element {
      return this._closed ? null : this._element;
  }
  setProgress(params: number|{progress: number, leftText?: string, rightText?: string}) {
    const {progress, leftText = '', rightText = ''} = typeof params === 'number' ? {progress: params} : params;
    this.willResizeEvent.dispatch();
    this._element.classList.toggle('visible', progress >= 0);
    this._leftText.textContent = leftText;
    this._rightText.textContent = rightText;
    this._progress.value = progress;
    host.sendMessage({
      method: 'setProgress',
      params: {
        progress
      }
    });
  }
  deactivate() {
    if (this._element.classList.contains('visible')) {
      host.sendMessage({
        method: 'setProgress',
        params: {
          progress: -1
        }
      });
      return;
    }
    this._element.remove();
    this._closed = true;
  }
}