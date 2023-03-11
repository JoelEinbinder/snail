import { registerMode, getMode } from '../../editor/js/modeRegistry';
import type { Mode } from '../../editor/js/highlighter';
import { StringStream } from '../../editor/js/StringStream';

type State = {
  tokenIndex: number,
  /** if we split across lines we need to track this */
  characterIndex: number,
};
type Token = {}
class FakeMode implements Mode<State> {
  constructor(private _options: { indentUnit: number, tokens?: Token[], actualLang?: string}) {
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
    stream.next();
    return '#F0F';
  }
  hover(state: State): string | Node | null {
      return 'fake!';
  }
}
registerMode('<fake>', (options: any, parserConfig) => {
  if (options.actualLang)
    return getMode(options.actualLang)?.(options, parserConfig);
  return new FakeMode(options);
});