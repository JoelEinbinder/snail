/**
 * @typedef {Object} Token
 * @property {string} text
 * @property {string=} color
 * @property {string=} background
 */

class Highlighter extends Emitter {
  /**
   * @param {Model} model
   * @param {string} language
   * @param {function(number,  string):Array<Token>} underlay
   */
  constructor(model, language = 'js', underlay = null) {
    super();
    this._model = model;
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
    this._selectionColors =
      navigator.platform.indexOf('Mac') === -1
        ? {
            color: '#ffffff',
            background: '#308efe'
          }
        : {
            background: '#b3d8fd'
          };
    this._mode = language === 'js' ? javascriptMode({ indentUnit: 2 }, {}) : cssMode({ indentUnit: 2 }, {});
    this._underlay = underlay;
    /** @type {Array<{state: any, tokens: Array<Token>}>} */
    this._lines = [];
    this._requestLineNumber = 0;
    this._tokenizeTimeout = 0;
    this.MAX_TOKENS = 1000;
    this._colors =
      language === 'js'
        ? [
            ['keyword', 'hsl(310, 86%, 36%)'],
            ['number', 'hsl(248, 100%, 41%)'],
            ['comment', 'hsl(120, 100%, 23%)'],
            ['string', 'hsl(1, 80%, 43%)'],
            ['string', 'hsl(1, 99%, 39%)'],
            ['atom', 'hsl(310, 86%, 36%)'],
            ['def', 'hsl(240, 73%, 38%)'],
            ['operator', 'hsl(27, 100%, 30%)'],
            ['meta', 'hsl(27, 100%, 30%)'],
            ['variable', 'hsl(240, 73%, 38%)']
          ]
        : [
            ['keyword ', 'rgb(7, 144, 154)'],
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

  _requestTokenizeUpTo(lineNumber) {
    this._requestLineNumber = Math.max(lineNumber, this._requestLineNumber);
    if (this._tokenizeTimeout) return;
    this._tokenizeTimeout = setTimeout(() => {
      this._tokenizeTimeout = 0;
      var from = this._lines.length;
      var start = Date.now();
      while (this._lines.length <= this._requestLineNumber && Date.now() - start < 10)
        this._tokenizeUpTo(this._lines.length);
      this._requestTokenizeUpTo(this._requestLineNumber);
      this.emit('highlight', { from, to: this._lines.length - 1 });
    }, 100);
  }

  /**
   * @param {number} lineNumber
   * @param {number=} max
   */
  _tokenizeUpTo(lineNumber, max) {
    if (max && this._model.charCountForLines(this._lines.length, lineNumber) > max) {
      this._requestTokenizeUpTo(lineNumber);
      return;
    }
    var state = this._lines.length ? this._lines[this._lines.length - 1].state : this._mode.startState();
    for (var i = this._lines.length; i <= lineNumber; i++) {
      var tokens = [];
      var stream = new StringStream(this._model.line(i));
      if (stream.eol() && this._mode.blankLine) this._mode.blankLine(state);
      while (!stream.eol()) {
        var className = this._mode.token(stream, state) || '';
        var text = stream.string.substring(stream.start, stream.pos);
        var color = null;
        for (var [name, c] of this._colors) {
          if (className.indexOf(name) !== -1) color = c;
        }
        tokens.push({ text, color });
        stream.start = stream.pos;
        if (tokens.length > this.MAX_TOKENS) {
          state = this._mode.startState();
          tokens.push({
            text: stream.string.substring(stream.start),
            color: null
          });
          break;
        }
      }

      this._lines.push({ state, tokens });
      state = this._copyState(state);
    }
  }

  /**
   * @template T
   * @param {T} state
   * @return {T}
   */
  _copyState(state) {
    if (Array.isArray(state)) return /** @type {T & any[]} */ (state.slice(0));
    if (typeof state === 'object' && state !== null) {
      var copy = {};
      for (var i in state) {
        copy[i] = this._copyState(state[i]);
      }
      return /** @type {T} */ (copy);
    }

    return state;
  }

  /**
   * @param {number} lineNumber
   * @return {Array<Token>}
   */
  tokensForLine(lineNumber) {
    /**
     * @param {Array<Token>} a
     * @param {Array<Token>} b
     * @return {Array<Token>}
     */
    const mergeTokens = (a, b) => {
      var tokens = [];
      var line = this._model.line(lineNumber);
      var text = '';
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
        if (aCount >= aToken.text.length) {
          console.assert(aCount == aToken.text.length);
          aIndex++;
          aCount = 0;
        }
        if (bCount >= bToken.text.length) {
          console.assert(bCount == bToken.text.length);
          bIndex++;
          bCount = 0;
        }
        aToken = a[aIndex];
        bToken = b[bIndex];
        const nextColor = bToken.color || aToken.color;
        const nextBackground = bToken.background || aToken.background;
        if ((nextColor !== color || nextBackground !== background) && text) {
          tokens.push({ text: text, color, background });
          text = '';
        }
        color = nextColor;
        background = nextBackground;
        var amount = Math.min(aToken.text.length - aCount, bToken.text.length - bCount);
        text += line.substr(i, amount);
        aCount += amount;
        bCount += amount;
        i += amount;
      }
      if (text) tokens.push({ text: text, color, background });
      return tokens;
    };

    this._tokenizeUpTo(lineNumber, 10000);
    var text = this._model.line(lineNumber);
    var mergedTokens = this._lines[lineNumber]
      ? mergeTokens(this._lines[lineNumber].tokens, this._selectionTokens(lineNumber))
      : mergeTokens([{ text }], this._selectionTokens(lineNumber)); // default

    if (this._underlay) return mergeTokens(this._underlay.call(null, lineNumber, text), mergedTokens);
    return mergedTokens;
  }

  /**
   * @param {number} lineNumber
   * @return {Array<Token>}
   */
  _selectionTokens(lineNumber) {
    var ranges = [];
    var tokens = [];
    var line = this._model.line(lineNumber);
    for (var selection of this._model.selections) {
      if (!isSelectionCollapsed(selection) && selection.start.line <= lineNumber && selection.end.line >= lineNumber) {
        ranges.push({
          start: selection.start.line === lineNumber ? selection.start.column : 0,
          end: selection.end.line === lineNumber ? selection.end.column : line.length
        });
      }
    }
    ranges.sort((a, b) => a.start - b.start);
    var index = 0;
    for (var range of ranges) {
      if (index !== range.start) tokens.push({ text: line.substring(index, range.start) });
      tokens.push({
        text: line.substring(range.start, range.end),
        color: this._selectionColors.color,
        background: this._selectionColors.background
      });
      index = range.end;
    }
    if (index !== line.length) tokens.push({ text: line.substring(index, line.length) });
    return tokens;
  }
}

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

// STRING STREAM

// Fed to the mode parsers, provides helper functions to make
// parsers more succinct.

/**
 *
 * @param {string} string
 * @param {number=} tabSize
 * @param {any=} lineOracle
 */
var StringStream = function(string, tabSize, lineOracle) {
  this.pos = this.start = 0;
  this.string = string;
  this.tabSize = tabSize || 8;
  this.lastColumnPos = this.lastColumnValue = 0;
  this.lineStart = 0;
  this.lineOracle = lineOracle;
};

StringStream.prototype.eol = function() {
  return this.pos >= this.string.length;
};
StringStream.prototype.sol = function() {
  return this.pos == this.lineStart;
};
StringStream.prototype.peek = function() {
  return this.string.charAt(this.pos) || undefined;
};
StringStream.prototype.next = function() {
  if (this.pos < this.string.length) {
    return this.string.charAt(this.pos++);
  }
};
StringStream.prototype.eat = function(match) {
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
};
StringStream.prototype.eatWhile = function(match) {
  var start = this.pos;
  while (this.eat(match)) {}
  return this.pos > start;
};
StringStream.prototype.eatSpace = function() {
  var this$1 = this;

  var start = this.pos;
  while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) {
    ++this$1.pos;
  }
  return this.pos > start;
};
StringStream.prototype.skipToEnd = function() {
  this.pos = this.string.length;
};
StringStream.prototype.skipTo = function(ch) {
  var found = this.string.indexOf(ch, this.pos);
  if (found > -1) {
    this.pos = found;
    return true;
  }
};
StringStream.prototype.backUp = function(n) {
  this.pos -= n;
};
StringStream.prototype.column = function() {
  if (this.lastColumnPos < this.start) {
    this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
    this.lastColumnPos = this.start;
  }
  return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0);
};
StringStream.prototype.indentation = function() {
  return (
    countColumn(this.string, null, this.tabSize) -
    (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
  );
};
StringStream.prototype.match = function(pattern, consume, caseInsensitive) {
  if (typeof pattern == 'string') {
    var cased = function(str) {
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
};
StringStream.prototype.current = function() {
  return this.string.slice(this.start, this.pos);
};
StringStream.prototype.hideFirstChars = function(n, inner) {
  this.lineStart += n;
  try {
    return inner();
  } finally {
    this.lineStart -= n;
  }
};
StringStream.prototype.lookAhead = function(n) {
  var oracle = this.lineOracle;
  return oracle && oracle.lookAhead(n);
};
StringStream.prototype.baseToken = function() {
  var oracle = this.lineOracle;
  return oracle && oracle.baseToken(this.pos);
};

// Counts the column offset in a string, taking tabs into account.
// Used mostly to find indentation.
function countColumn(string, end, tabSize, startIndex, startValue) {
  if (end == null) {
    end = string.search(/[^\s\u00a0]/);
    if (end == -1) {
      end = string.length;
    }
  }
  for (var i = startIndex || 0, n = startValue || 0; ; ) {
    var nextTab = string.indexOf('\t', i);
    if (nextTab < 0 || nextTab >= end) {
      return n + (end - i);
    }
    n += nextTab - i;
    n += tabSize - n % tabSize;
    i = nextTab + 1;
  }
}
