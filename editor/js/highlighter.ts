import { Emitter } from './emitter';
import { isSelectionCollapsed } from './model.js';
import { getMode } from './modeRegistry';

type Token = {
  length: number;
  color?: string;
  background?: string;
};

export interface Mode<State> {
  startState(): State;
  blankLine?: (state: State) => void;
  token(stream: StringStream, state: State): string|null;
  indent(state: State, textAfter: string): number;
};
const MAX_TOKENS = 1000;
export class Highlighter extends Emitter<{
  'highlight': {from: number, to: number};
}> {
  private _selectionColors: {color?: string, background?: string};
  private _mode: Mode<any>;
  private _lineInfo = new WeakMap<import('./model').Line, {state: Object, tokens: Array<Token>}>();
  private _currentLineNumber = 0;
  private _requestLineNumber = 0;
  private _tokenizeTimeout = 0;
  private _colors: [string, string][];
  constructor(
    private _model: import('./model').Model,
    private _language: string = 'js',
    private _underlay: (arg0: number, arg1: string) => Array<Token> = null,
    colors: { selectionBackground?: string; } | undefined = {}) {
    super();
    this._model.on('selectionChanged', ({ selections, previousSelections }) => {
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
    this._model.on('change', range => {
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

    this._colors =
      (_language === 'js' || _language === 'shjs')
        ? [
            ['keyword', '#af5fff'],
            ['number', '#999900'],
            ['comment', '#666666'],
            ['string', '#00A600'],
            ['string-2', '#00A600'],
            // ['atom', '#F4F4F4'],
            // ['def', '#F4F4F4'],
            // ['operator', '#F4F4F4'],
            // ['meta', '#F4F4F4'],
            ['variable', '#afd7ff'],
            ['property', '#afd7ff'],
            ['def', '#afd7ff'],
            ['sh', '#f4f4f4'],
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
          ];
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
      ? this._copyState(this._lineInfo.get(this._model.line(this._currentLineNumber - 1)).state)
      : this._mode.startState();
    for (
      ;
      this._currentLineNumber <= lineNumber && (!timeLimit || Date.now() - start < timeLimit);
      this._currentLineNumber++
    ) {
      var tokens = [];
      var line = this._model.line(this._currentLineNumber);
      var stream = new StringStream(line.text);
      if (stream.eol() && this._mode.blankLine) this._mode.blankLine(state);
      while (!stream.eol()) {
        var className = this._mode.token(stream, state) || '';
        var color = null;
        for (var [name, c] of this._colors) {
          if (className.indexOf(name) !== -1) color = c;
        }
        tokens.push({ length: stream.pos - stream.start, color });
        stream.start = stream.pos;
        if (tokens.length > MAX_TOKENS) {
          state = this._mode.startState();
          tokens.push({
            length: stream.string.length - stream.start,
            color: null
          });
          break;
        }
      }
      this._lineInfo.set(line, { state: null, tokens });
    }
    if (line) this._lineInfo.get(line).state = this._copyState(state);
  }

  indentation(lineNumber: number) {
    const line = this._model.line(lineNumber);
    if (!this._lineInfo.has(line))
      return;
    const state = this._lineInfo.get(line).state;
    if (!state)
      return;
    const copy = this._copyState(state);
    this._mode.token(new StringStream('\n'), copy);
    return this._mode.indent(copy, '');
  }

  setModeOptions(options: any) {
    this._mode = getMode(this._language)?.({ indentUnit: 2, ...options }, {});
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
      var tokens = [];
      var line = this._model.line(lineNumber);
      var length = 0;
      var color = null;
      var background = null;
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
      ? mergeTokens(this._lineInfo.get(line).tokens, this._selectionTokens(lineNumber))
      : mergeTokens([{ length: line.length }], this._selectionTokens(lineNumber)); // default

    if (this._underlay) return mergeTokens(this._underlay.call(null, lineNumber, line.text), mergedTokens);
    return mergedTokens;
  }

  _selectionTokens(lineNumber: number): Array<Token> {
    var ranges = [];
    var tokens = [];
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

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// STRING STREAM

// Fed to the mode parsers, provides helper functions to make
// parsers more succinct.
export class StringStream {
  pos = 0;
  start = 0;
  lineStart = 0;
  lastColumnPos = 0;
  lastColumnValue = 0;
  constructor(
    public string: string,
    public tabSize: number = 2,
    public lineOracle?: any) {
  }
  eol() {
    return this.pos >= this.string.length;
  }

  sol() {
    return this.pos == this.lineStart;
  }
  peek() {
    return this.string.charAt(this.pos) || undefined;
  }
  next() {
    if (this.pos < this.string.length) {
      return this.string.charAt(this.pos++);
    }
  }
  eat(match) {
    var ch = this.string.charAt(this.pos);
    var ok;
    if (typeof match == 'string') {
      ok = ch == match;
    } else {
      ok = ch && (match.test ? match.test(ch) : match(ch));
    }
    if (ok) {
      ++this.pos;
      return ch;
    }
  }
  eatWhile(match) {
    var start = this.pos;
    while (this.eat(match)) { }
    return this.pos > start;
  }
  eatSpace() {
    var this$1 = this;

    var start = this.pos;
    while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) {
      ++this$1.pos;
    }
    return this.pos > start;
  }
  skipToEnd() {
    this.pos = this.string.length;
  }
  skipTo(ch) {
    var found = this.string.indexOf(ch, this.pos);
    if (found > -1) {
      this.pos = found;
      return true;
    }
  }
  backUp(n) {
    this.pos -= n;
  }
  column() {
    if (this.lastColumnPos < this.start) {
      this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
      this.lastColumnPos = this.start;
    }
    return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0);
  }
  indentation() {
    return (
      countColumn(this.string, null, this.tabSize) -
      (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
    );
  }
  match(pattern, consume, caseInsensitive) {
    if (typeof pattern == 'string') {
      var cased = function (str) {
        return caseInsensitive ? str.toLowerCase() : str;
      };
      var substr = this.string.substr(this.pos, pattern.length);
      if (cased(substr) == cased(pattern)) {
        if (consume !== false) {
          this.pos += pattern.length;
        }
        return true;
      }
    } else {
      var match = this.string.slice(this.pos).match(pattern);
      if (match && match.index > 0) {
        return null;
      }
      if (match && consume !== false) {
        this.pos += match[0].length;
      }
      return match;
    }
  }
  current() {
    return this.string.slice(this.start, this.pos);
  }
  hideFirstChars(n, inner) {
    this.lineStart += n;
    try {
      return inner();
    } finally {
      this.lineStart -= n;
    }
  }
  lookAhead(n) {
    var oracle = this.lineOracle;
    return oracle && oracle.lookAhead(n);
  }
  baseToken() {
    var oracle = this.lineOracle;
    return oracle && oracle.baseToken(this.pos);
  }
}

// Counts the column offset in a string, taking tabs into account.
// Used mostly to find indentation.
function countColumn(string: string, end: number|null, tabSize: number, startIndex = 0, startValue = 0) {
  if (end == null) {
    end = string.search(/[^\s\u00a0]/);
    if (end == -1) {
      end = string.length;
    }
  }
  for (var i = startIndex, n = startValue; ;) {
    var nextTab = string.indexOf('\t', i);
    if (nextTab < 0 || nextTab >= end) {
      return n + (end - i);
    }
    n += nextTab - i;
    n += tabSize - n % tabSize;
    i = nextTab + 1;
  }
}
