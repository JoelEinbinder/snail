import type { StringStream } from '@codemirror/language';
export interface Mode<State> {
  startState(): State;
  blankLine?: (state: State) => void;
  token(stream: StringStream, state: State): string|null;
  indent?(state: State, textAfter: string): number|undefined;
  hover?(state: State): Node|string|null;
};

const modes = new Map();
export function registerMode<T = any>(extension: string, mode: (config: {indentUnit: number}, parserConfig: any) => Mode<T>) {
  modes.set(extension, mode);
}
export function getMode(extension: string): (config: {indentUnit: number}, parserConfig: any) => Mode<any> {
  return modes.get(extension) || null;
}
