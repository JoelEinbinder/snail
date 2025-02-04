import { Emitter } from './emitter';
import { isSelectionCollapsed, Loc, type Line } from './model';
import { getMode } from './modeRegistry';
import { StringStream } from './StringStream';

export type Token = {
  length: number;
  color?: string;
  background?: string;
};

export interface Mode<State> {
  startState(): State;
  blankLine?: (state: State) => void;
  token(stream: StringStream, state: State): string|null;
  indent?(state: State, textAfter: string): number|undefined;
  hover?(state: State): Node|string|null;
  lineComment?: string;
};
const MAX_TOKENS = 1000;
export class Highlighter extends Emitter<{
  'highlight': {from: number, to: number};
}> {
  private _selectionColors: {color?: string, background?: string};
  private _mode: Mode<any> | null;
  private _lineInfo = new WeakMap<import('./model').Line, {state: any, tokens: Array<Token>}>();
  private _currentLineNumber = 0;
  private _requestLineNumber = 0;
  private _tokenizeTimeout = 0;
  private _colors: [string, string][];
  private _modeOptions: any;
  constructor(
    private _model: import('./model').Model,
    private _commandManager: import('./commands').CommandManager,
    private _language: string = 'js',
    private _underlay?: (arg0: number, arg1: string) => Token[],
    colors: { selectionBackground?: string; foreground?: string, textColor?: string, tokenColors?: [string, string][] } | undefined = {},) {
    super();
    this._model.on('selection-changed', ({ selections, previousSelections }) => {
      for (var selection of selections)
        this.emit('highlight', {
          from: selection.start.line,
          to: selection.end.line
        });
      for (var selection of previousSelections)
        this.emit('highlight', {
          from: selection.start.line,
          to: selection.end.line
        });
    });
    this._model.on('change', ({range}) => {
      this._findCurrentLineNumber(range.start.line);
      this.emit('highlight', {
        from: range.start.line,
        to: this._model.lineCount() - 1
      });
    });
    if (colors.selectionBackground) {
      this._selectionColors = {
        background: colors.selectionBackground
      }
    } else {
      this._selectionColors = navigator.platform.indexOf('Mac') === -1
      ? {
          color: '#ffffff',
          background: '#308efe'
        }
      : {
          background: '#b3d8fd'
        };
    }
      
    this._mode = getMode(_language)?.({ indentUnit: 2 }, {});

    this._colors = colors.tokenColors || (
      (_language !== 'css')
        ? [
            ['keyword', '#af5fff'],
            ['number', '#999900'],
            ['comment', '#666666'],
            ['string', '#00A600'],
            ['string-2', '#00A600'],
            ['variable', '#0000A6'],
            ['property', '#0000A6'],
            ['def', '#0000A6'],
            ['sh', colors.foreground || '#222'],
            ['sh-replacement', '#E5E500'],
            ['sh-template', '#00A6B2'],
            ['sh-string', '#999900'],
            ['sh-comment', '#666666'],
          ]
        : [
            ['keyword', 'rgb(7, 144, 154)'],
            ['number', 'rgb(50, 0, 255)'],
            ['comment', 'rgb(0, 116, 0)'],
            ['def', 'rgb(200, 0, 0)'],
            ['meta', 'rgb(200, 0, 0)'],
            ['atom', 'rgb(7, 144, 154)'],
            ['string', 'rgb(7, 144, 154)'],
            ['string-2', 'rgb(7, 144, 154)'],
            ['link', 'rgb(7, 144, 154)'],
            ['variable', 'rgb(200, 0, 0)'],
            ['variable-2', 'rgb(0, 0, 128)'],
            ['property', 'rgb(200, 0, 0)']
          ]);

    this._commandManager.addCommand(() => {
      if (!this._mode?.lineComment)
        return false;
      const selections = [...this._model.selections].map(s => ({start: {...s.start}, end: {...s.end}}));
      if (!selections.length)
        return false;
      const lineComment = this._mode.lineComment;
      const lines = new Set<number>();
      for (const selection of selections) {
        for (let i = selection.start.line; i <= selection.end.line; i++)
          lines.add(i);
      }
      let isCommented = true;
      for (const line of lines) {
        const text = this._model.line(line).text;
        if (!text.trimStart().startsWith(lineComment)) {
          isCommented = false;
          break;
        }
      }
      for (const line of lines) {
        const text = this._model.line(line).text;
        if (isCommented) {
          const { index, 0: match } = /\/\/ ?/.exec(text)!;          
          this._model.replaceRange('', { start: {line, column: index}, end: {line, column: index + match.length} });
          for (const selection of selections) {
            if (selection.start.line === line && selection.start.column > index)
              selection.start.column -= match.length;
            if (selection.end.line === line && selection.end.column > index)
              selection.end.column -= match.length;
          }
        } else {
          this._model.replaceRange('// ', { start: {line, column: 0}, end: {line, column: 0} });
          for (const selection of selections) {
            if (selection.start.line === line)
              selection.start.column += '// '.length;
            if (selection.end.line === line)
              selection.end.column += '// '.length;
          }
        }
      }
      this._model.setSelections(selections);
      return true;
    }, 'toggleLineComment', 'Ctrl+/', 'Meta+/');
  }

  _findCurrentLineNumber(from: number) {
    this._currentLineNumber = Math.min(this._currentLineNumber, from);
    while (this._currentLineNumber) {
      var lineinfo = this._lineInfo.get(this._model.line(this._currentLineNumber - 1));
      if (lineinfo && lineinfo.state) break;
      this._currentLineNumber--;
    }
    this._requestLineNumber = this._currentLineNumber;
  }

  _requestTokenizeUpTo(lineNumber) {
    this._requestLineNumber = Math.max(lineNumber, this._requestLineNumber);
    if (this._tokenizeTimeout) return;
    var fn = idleDeadline => {
      this._tokenizeTimeout = 0;
      var from = this._currentLineNumber;
      this._tokenizeUpTo(this._requestLineNumber, undefined, idleDeadline ? idleDeadline.timeRemaining() : 32);
      if (this._currentLineNumber < this._requestLineNumber) this._requestTokenizeUpTo(this._requestLineNumber);
      this.emit('highlight', { from, to: this._currentLineNumber - 1 });
    };
    this._tokenizeTimeout = window['requestIdleCallback'] ? window['requestIdleCallback'](fn) : setTimeout(fn, 100);
  }

  _tokenizeUpTo(lineNumber: number, max?: number, timeLimit?: number) {
    if (!this._mode) return;
    if (this._currentLineNumber > lineNumber) return;
    if (
      max &&
      (lineNumber - this._currentLineNumber > max / 10 ||
        this._model.charCountForLines(this._currentLineNumber, lineNumber) > max)
    ) {
      this._requestTokenizeUpTo(lineNumber);
      return;
    }
    var start = timeLimit && Date.now();
    var state = this._currentLineNumber
      ? this._copyState(this._lineInfo.get(this._model.line(this._currentLineNumber - 1))!.state)
      : this._mode.startState();
    let line: Line|undefined;
    for (
      ;
      this._currentLineNumber <= lineNumber && (!timeLimit || Date.now() - start! < timeLimit);
      this._currentLineNumber++
    ) {
      const tokens: Token[] = [];
      line = this._model.line(this._currentLineNumber);
      const stream = new StringStream(line.text);
      if (stream.eol() && this._mode.blankLine) this._mode.blankLine(state);
      while (!stream.eol()) {
        const className = this._mode.token(stream, state) || '';
        let color: string|undefined = undefined;
        for (const [name, c] of this._colors) {
          if (className.indexOf(name) !== -1) color = c;
        }
        if (!color && /^(?:#|rgba?\(|hsla?\()/.test(className)) color = className;
        tokens.push({ length: stream.pos - stream.start, color });
        stream.start = stream.pos;
        if (tokens.length > MAX_TOKENS) {
          state = this._mode.startState();
          tokens.push({
            length: stream.string.length - stream.start,
          });
          break;
        }
      }
      this._lineInfo.set(line, { state: null, tokens });
    }
    if (line) this._lineInfo.get(line)!.state = this._copyState(state);
  }

  indentation(lineNumber: number): number {
    if (!this._mode)
      return 0;
    const line = this._model.line(lineNumber);
    if (!this._lineInfo.has(line))
      return 0;
    const state = this._lineInfo.get(line)!.state;
    if (!state)
      return 0;
    return this._mode.indent?.(state, '') || 0;
  }

  setModeOptions(options: any) {
    this._modeOptions = options;
    this._refreshMode();
  }

  setMode(language: string) {
    this._language = language;
    this._refreshMode();
  }

  language() {
    return this._language;
  }

  _refreshMode() {
    this._mode = getMode(this._language)?.({ indentUnit: 2, ...this._modeOptions }, {});
    this._currentLineNumber = 0;
    this.emit('highlight', {
      from: 0,
      to: this._model.lineCount() - 1
    });
  }

  _copyState<T>(state: T, depth = 2): T {
    if (Array.isArray(state)) return state.slice(0) as T & any[];
    if (depth && typeof state === 'object' && state !== null) {
      const copy = {} as T;
      for (var i in state) {
        copy[i] = this._copyState(state[i], depth - 1);
      }
      return copy;
    }

    return state;
  }

  tokensForLine(lineNumber: number): Array<Token> {
    const mergeTokens = (a: Array<Token>, b: Array<Token>): Array<Token> => {
      var tokens: Token[] = [];
      var line = this._model.line(lineNumber);
      var length = 0;
      var color: string|undefined = undefined;
      var background: string|undefined = undefined;
      var aIndex = 0;
      var bIndex = 0;
      var aToken = a[aIndex];
      var bToken = b[aIndex];
      var aCount = 0;
      var bCount = 0;
      var i = 0;
      while (i < line.length) {
        if (aCount >= aToken.length) {
          console.assert(aCount == aToken.length);
          aIndex++;
          aCount = 0;
        }
        if (bCount >= bToken.length) {
          console.assert(bCount == bToken.length);
          bIndex++;
          bCount = 0;
        }
        aToken = a[aIndex];
        bToken = b[bIndex];
        const nextColor = bToken.color || aToken.color;
        const nextBackground = bToken.background || aToken.background;
        if ((nextColor !== color || nextBackground !== background) && length) {
          tokens.push({ length, color, background });
          length = 0;
        }
        color = nextColor;
        background = nextBackground;
        var amount = Math.min(aToken.length - aCount, bToken.length - bCount);
        length += amount;
        aCount += amount;
        bCount += amount;
        i += amount;
      }
      if (length) tokens.push({ length, color, background });
      return tokens;
    };

    this._tokenizeUpTo(lineNumber, 10000);
    var line = this._model.line(lineNumber);
    var mergedTokens = this._lineInfo.has(line)
      ? mergeTokens(this._lineInfo.get(line)!.tokens, this._selectionTokens(lineNumber))
      : mergeTokens([{ length: line.length }], this._selectionTokens(lineNumber)); // default

    if (this._underlay) return mergeTokens(this._underlay.call(null, lineNumber, line.text), mergedTokens);
    return mergedTokens;
  }

  hoverForLocation(loc: Loc): { content: string | Node, reposition: Loc } | null {
    if (!this._mode?.hover)
      return null;
    const line = this._model.line(loc.line);
    if (!line)
      return null;

    const state = loc.line
      ? this._copyState(this._lineInfo.get(this._model.line(loc.line - 1))!.state)
      : this._mode.startState();
    let tokenCount = 0;
    const stream = new StringStream(line.text);
    let startColumn = 0;
    let startState = this._copyState(state);
    while (!stream.eol() && stream.pos < loc.column) {
      tokenCount++;
      startColumn = stream.pos;
      startState = this._copyState(state);
      this._mode.token(stream, state);
      if (tokenCount > MAX_TOKENS)
        return null;
    }

    const content = this._mode.hover(startState);
    if (!content)
      return null;
    return {
      content,
      reposition: { line: loc.line, column: startColumn },
    };
  }

  _selectionTokens(lineNumber: number): Array<Token> {
    var ranges: {start: number, end: number}[] = [];
    var tokens: Token[] = [];
    var { length } = this._model.line(lineNumber);
    for (var selection of this._model.selections) {
      if (!isSelectionCollapsed(selection) && selection.start.line <= lineNumber && selection.end.line >= lineNumber) {
        ranges.push({
          start: selection.start.line === lineNumber ? selection.start.column : 0,
          end: selection.end.line === lineNumber ? selection.end.column : length
        });
      }
    }
    ranges.sort((a, b) => a.start - b.start);
    var index = 0;
    for (var range of ranges) {
      if (index !== range.start) tokens.push({ length: range.start - index });
      tokens.push({
        length: range.end - range.start,
        color: this._selectionColors.color,
        background: this._selectionColors.background
      });
      index = range.end;
    }
    if (index !== length) tokens.push({ length: length - index });
    return tokens;
  }
}
