import { registerMode, getMode } from '../../editor/js/modeRegistry';
import type { Mode } from '../../editor/js/highlighter';
import { StringStream } from '../../editor/js/StringStream';

type State = {
  tokenIndex: number,
  /** if we split across lines we need to track this */
  characterIndex: number,
};
type Token = {
  text: string;
  hover?: string;
  color: string;
};
class FakeMode implements Mode<State> {
  private _tokens: Token[];
  constructor(options: { indentUnit: number, tokens?: Token[] }) {
    this._tokens = options.tokens || [];
  }
  startState(): State {
    return {
      tokenIndex: 0,
      characterIndex: 0,
    }
  }
  blankLine(state: State): void {
    this.token(new StringStream(''), state);
  }
  token(stream: StringStream, state: State): string | null {
    if (this._tokens[state.tokenIndex]?.text[state.characterIndex] === '\n') {
      state.characterIndex++;
      if (state.characterIndex >= this._tokens[state.tokenIndex].text.length) {
        state.tokenIndex++;
        state.characterIndex = 0;  
      }
      if (stream.eol())
        return null;
    }
    if (state.tokenIndex >= this._tokens.length) {
      stream.skipToEnd();
      return null;
    }
    const token = this._tokens[state.tokenIndex];

    let partialTokenLength = Math.min(stream.string.length - stream.pos, token.text.length - state.characterIndex);
    stream.pos += partialTokenLength;
    if (stream.eol() && token.text[partialTokenLength + state.characterIndex] === '\n')
      partialTokenLength++;
    if (state.characterIndex + partialTokenLength === token.text.length) {
      state.characterIndex = 0;
      state.tokenIndex++;
    } else {
      state.characterIndex += partialTokenLength;
    }
    return token.color;
  }
  hover(state: State): string | Node | null {
    if (state.tokenIndex >= this._tokens.length)
      return null;
    return this._tokens[state.tokenIndex].hover || null;
  }
}
registerMode('<fake>', (options: { indentUnit: number, tokens?: Token[], actualLang?: string}, parserConfig) => {
  if (options.actualLang)
    return getMode(options.actualLang)?.(options, parserConfig);
  return new FakeMode(options);
});