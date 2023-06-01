

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
      // @ts-ignore
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
