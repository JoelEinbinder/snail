import type { Findable, FindParams } from "../Find";
import type { Terminal } from 'xterm';

export type FindState = {
  matches: { start: [number, number], end: [number, number] }[];
  activeMatch: number;
}

export class FindService implements Findable {
  private _regex?: RegExp;
  constructor(
    private _terminal: Terminal,
    private _setFindState: (state: FindState) => void) {

  }
  setFind(params: FindParams): void {
    if (!params) {
      delete this._regex;
      this._setFindState({ matches: [], activeMatch: -1 });
      return;
    }
    this._regex = params.regex;
    const state: FindState = {
      matches: [],
      activeMatch: -1,
    };
    
    for (let i = 0; i < this._terminal.buffer.active.length; i++) {
      const line = this._terminal.buffer.active.getLine(i);
      const text = line.translateToString(false);
      let match;
      while (match = this._regex!.exec(text)) {
        state.matches.push({
          start: [match.index, i],
          end: [match.index + match[0].length, i],
        });
      }
    }
    this._setFindState(state);
    params.report(state.matches.length);
  }
}