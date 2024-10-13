
import type { JoelEvent } from '../slug/cdp-ui/JoelEvent';
import type { Findable } from './Find';
import type { Action } from './actions';

export interface LogItem extends Findable {
  willResizeEvent: JoelEvent<void>;
  toggleFold?: JoelEvent<boolean>;
  removeSelf?: () => void;
  render(): Element;
  focus(): void;
  dispose(): void;
  serializeForTest(): Promise<any>;
  recieveLLMAction?(iterator: AsyncIterable<import('openai').OpenAI.Chat.ChatCompletionChunk>, signal?: AbortSignal): Promise<void>;
  serializeForLLM?(): Promise<import('openai').OpenAI.Chat.ChatCompletionMessageParam|null>;
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
