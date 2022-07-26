import {registerMode, getMode} from '../editor/js/modeRegistry';
import type { Mode, StringStream } from '../editor/js/highlighter';
import { parseCodeIntoTokens } from './transform';
import '../editor/modes/javascript';

type State = {
  textBefore: string;
  innerState: any;
  tokens: import('acorn').Token[];
};
class ShjsMode implements Mode<State> {
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
      return { textBefore: '', tokens: [], innerState: this.innerMode.startState() };
  }
  token(stream: StringStream, state: State): string {
    const newStuff = stream.string.slice(stream.pos);
    const fullText = state.textBefore + newStuff;
    if (!state.tokens.length)
      state.tokens = parseCodeIntoTokens(fullText, this.options.globalVars);
    while (state.tokens.length) {
      const token = state.tokens.shift();
      if (token.start === token.end)
        continue;
      if (token.start > state.textBefore.length) {
        state.tokens.unshift(token);
        break;
      }
      if (token.start >= state.textBefore.length) {
        if (token.type.label === 'sh') {
          const tokenText = fullText.slice(token.start, token.end);
          state.textBefore += tokenText;
          stream.pos += tokenText.length;
          return 'sh';
        }
      } else {
      }
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