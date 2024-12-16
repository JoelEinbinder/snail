
import type { JoelEvent } from '../slug/cdp-ui/JoelEvent';
import type { Findable } from './Find';
import type { Action } from './actions';

export type LLMMessage = { role:'user'|'assistant', content: string };
export interface LogItem extends Findable {
  willResizeEvent: JoelEvent<void>;
  titleChangedEvent?: JoelEvent<string|null>;
  toggleFold?: JoelEvent<boolean>;
  removeSelf?: () => void;
  render(): Element;
  focus(): void;
  dispose(): void;
  serializeForTest(): Promise<any>;
  recieveLLMAction?(iterator: AsyncIterable<string>, signal?: AbortSignal): Promise<void>;
  serializeForLLM?(): Promise<LLMMessage|null>;
  flushForLLM?(): Promise<void>;
  waitForLineForTest?(regex: RegExp, signal?: AbortSignal): Promise<void>;
  isFullscreen?(): boolean;
  onScroll?(): void;
  wasShown?(): void;
  willHide?(): void;
  aysncActions?(): Promise<Action[]>;
  recieveFilePath?(filePath: string): void;
  readonly acceptsChildren?: boolean;
}
