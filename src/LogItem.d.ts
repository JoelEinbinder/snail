
import type { JoelEvent } from '../slug/cdp-ui/JoelEvent';
import type { Findable } from './Find';
import type { Action } from './actions';

export interface LogItem extends Findable {
  willResizeEvent: JoelEvent<void>;
  render(): Element;
  focus(): void;
  dispose(): void;
  serializeForTest(): Promise<any>;
  waitForLineForTest?(regex: RegExp, signal?: AbortSignal): Promise<void>;
  isFullscreen?(): boolean;
  onScroll?(): void;
  aysncActions?(): Promise<Action[]>;
}
