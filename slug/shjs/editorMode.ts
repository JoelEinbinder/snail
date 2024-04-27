import {registerMode, getMode} from '../editor/js/modeRegistry';
import type { Mode } from '../editor/js/highlighter';
import { parseCodeIntoTokens } from './transform';
import '../editor/modes/javascript';
import type { StringStream } from '../editor/js/StringStream';

type State = {
  textBefore: string;
  innerState: any;
  tokens: import('acorn').Token[];
  shTokens: import('../shjs/tokenizer').Token[];
};
export class ShjsMode implements Mode<State> {
  innerMode: Mode<any>;
  constructor(public options: {indentUnit: number, globalVars?: Set<string>}) {
    this.innerMode = getMode('js')({indentUnit: options.indentUnit}, {});
  }
  blankLine(state: State): void {
    this.innerMode.blankLine?.(state.innerState);
  }
  indent(state: State, textAfter: string): number {
    return this.innerMode.indent(state.innerState, textAfter);
  }
  startState(): State {
      return { textBefore: '', tokens: [], innerState: this.innerMode.startState(), shTokens: [] };
  }
  token(stream: StringStream, state: State): string {
    const newStuff = stream.string.slice(stream.pos);
    const fullText = state.textBefore + newStuff;
    if (!state.tokens.length)
      state.tokens = parseCodeIntoTokens(fullText, this.options.globalVars).filter(x => x.start !== x.end);
    while (state.tokens.length) {
      const token = state.tokens.shift();
      if (token.start > state.textBefore.length) {
        state.tokens.unshift(token);
        break;
      }
      if (token.start >= state.textBefore.length) {
        if (token.type.label === 'sh') {
          state.shTokens = [...token.value.tokens];
        }
      } else if (token.end > state.textBefore.length && !state.shTokens.length && token.type.label === 'sh') {
        let tokenCursor = token.start;
        for (const shToken of token.value.tokens) {
          if (shToken.raw.length > state.textBefore.length - tokenCursor) {
            state.shTokens.push({
              ...shToken,
              raw: shToken.raw.slice(state.textBefore.length - tokenCursor),
            });
          }
          tokenCursor += shToken.raw.length;
        }
      }
    }
    if (state.shTokens.length) {
      const token = state.shTokens.shift();
      state.textBefore += token.raw;
      stream.pos += token.raw.length;
      if (stream.eol())
        state.textBefore += '\n';
      if (token.type === 'replacement')
        return 'sh-replacement';
      if (token.type === 'template')
        return 'sh-template';
      if (token.type === 'comment')
        return 'sh-comment';
      if (token.isQuoted)
        return 'sh-string';
      return 'sh';
    }

    const posBefore = stream.pos;
    const className = this.innerMode.token(stream, state.innerState);
    state.textBefore += stream.string.slice(posBefore, stream.pos);
    if (stream.eol())
      state.textBefore += '\n';
    return className;

  }
}
registerMode('shjs', (options) => new ShjsMode(options));