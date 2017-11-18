/** @typedef {{text :string, color: string}} Token */

class Highlighter {
    /**
     * @param {Model} model
     */
    constructor(model) {
        this._model = model;
        this._mode = javascriptMode({indentUnit: 2}, {});
        /** @type {Array<{state: any, tokens: Array<Token>>} */
        this._lines = [];
        this._defaultColor = '#222';

        this._colors = [
            ['keyword', "hsl(310, 86%, 36%)"],
            ['number', "hsl(248, 100%, 41%)"],
            ['comment', "hsl(120, 100%, 23%)"],
            ['string', "hsl(1, 80%, 43%)"],
            ['string', "hsl(1, 99%, 39%)"],
            ['atom', "hsl(310, 86%, 36%)"],
            ['def', "hsl(240, 73%, 38%)"],
            ['operator', "hsl(27, 100%, 30%)"],
            ['meta', "hsl(27, 100%, 30%)"],
            ['variable', "hsl(240, 73%, 38%)"]
        ]
    }

    /**
     * @param {number} lineNumber
     * @param {number=} max
     */
    _tokenizeUpTo(lineNumber, max) {
        if (max && lineNumber - this._lines.length > max)
            return;
        var state = this._lines.length ? this._lines[this._lines.length - 1].state : this._mode.startState();
        for (var i = this._lines.length; i <= lineNumber; i++) {
            var tokens = [];
            var stream = new StringStream(this._model.line(i));
            if (stream.eol() && this._mode.blankLine)
                this._mode.blankLine(state);
            while (!stream.eol()) {
                var className = this._mode.token(stream, state) || '';
                var text = stream.string.substring(stream.start, stream.pos);
                var color = this._defaultColor;
                for (var [name, c] of this._colors) {
                    if (className.indexOf(name) !== -1)
                        color = c;
                }
                tokens.push({text, color});
                stream.start = stream.pos;
            }

            this._lines.push({state, tokens})
            state = this._copyState(state);
        }
    }

    /**
     * @template T
     * @param {T} state
     * @return {T}
     */
    _copyState(state) {
        if (Array.isArray(state))
            return state.slice(0);
        if (state === null)
            return null;
        if (typeof state === 'object') {
            var copy = {};
            for (var i in state) {
                copy[i] = this._copyState(state[i]);
            }
            return copy;
        }

        return state;
    }

    /**
     * @param {number} lineNumber
     * @return {Array<Token>}
     */
    tokensForLine(lineNumber) {
        this._tokenizeUpTo(lineNumber, 1000);
        if (this._lines[lineNumber]) {
            return this._lines[lineNumber].tokens;
        }

        // default
        var text = this._model.line(lineNumber);
        var color = this._defaultColor;
        return [text, color];
        var retVal = [];
        for (var i = 0; i < line.length; i+=4) {
            var color = i % 8 ? '#F00' : '#00F';
            retVal.push({text: line.substring(i, i+4), color});
        }
        return retVal;
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

StringStream.prototype.eol = function () {return this.pos >= this.string.length};
StringStream.prototype.sol = function () {return this.pos == this.lineStart};
StringStream.prototype.peek = function () {return this.string.charAt(this.pos) || undefined};
StringStream.prototype.next = function () {
  if (this.pos < this.string.length)
    { return this.string.charAt(this.pos++) }
};
StringStream.prototype.eat = function (match) {
  var ch = this.string.charAt(this.pos);
  var ok;
  if (typeof match == "string") { ok = ch == match; }
  else { ok = ch && (match.test ? match.test(ch) : match(ch)); }
  if (ok) {++this.pos; return ch}
};
StringStream.prototype.eatWhile = function (match) {
  var start = this.pos;
  while (this.eat(match)){}
  return this.pos > start
};
StringStream.prototype.eatSpace = function () {
    var this$1 = this;

  var start = this.pos;
  while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) { ++this$1.pos; }
  return this.pos > start
};
StringStream.prototype.skipToEnd = function () {this.pos = this.string.length;};
StringStream.prototype.skipTo = function (ch) {
  var found = this.string.indexOf(ch, this.pos);
  if (found > -1) {this.pos = found; return true}
};
StringStream.prototype.backUp = function (n) {this.pos -= n;};
StringStream.prototype.column = function () {
  if (this.lastColumnPos < this.start) {
    this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
    this.lastColumnPos = this.start;
  }
  return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
};
StringStream.prototype.indentation = function () {
  return countColumn(this.string, null, this.tabSize) -
    (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
};
StringStream.prototype.match = function (pattern, consume, caseInsensitive) {
  if (typeof pattern == "string") {
    var cased = function (str) { return caseInsensitive ? str.toLowerCase() : str; };
    var substr = this.string.substr(this.pos, pattern.length);
    if (cased(substr) == cased(pattern)) {
      if (consume !== false) { this.pos += pattern.length; }
      return true
    }
  } else {
    var match = this.string.slice(this.pos).match(pattern);
    if (match && match.index > 0) { return null }
    if (match && consume !== false) { this.pos += match[0].length; }
    return match
  }
};
StringStream.prototype.current = function (){return this.string.slice(this.start, this.pos)};
StringStream.prototype.hideFirstChars = function (n, inner) {
  this.lineStart += n;
  try { return inner() }
  finally { this.lineStart -= n; }
};
StringStream.prototype.lookAhead = function (n) {
  var oracle = this.lineOracle;
  return oracle && oracle.lookAhead(n)
};
StringStream.prototype.baseToken = function () {
  var oracle = this.lineOracle;
  return oracle && oracle.baseToken(this.pos)
};

// Counts the column offset in a string, taking tabs into account.
// Used mostly to find indentation.
function countColumn(string, end, tabSize, startIndex, startValue) {
  if (end == null) {
    end = string.search(/[^\s\u00a0]/);
    if (end == -1) { end = string.length; }
  }
  for (var i = startIndex || 0, n = startValue || 0;;) {
    var nextTab = string.indexOf("\t", i);
    if (nextTab < 0 || nextTab >= end)
      { return n + (end - i) }
    n += nextTab - i;
    n += tabSize - (n % tabSize);
    i = nextTab + 1;
  }
}