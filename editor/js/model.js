class Model extends Emitter {
  /**
   * @param {string} data
   */
  constructor(data) {
    super();
    this._lines = this._createLines(data);
    /** @type {Array<TextRange>} */
    this._selections = [{ start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }];

    /** @type {Array<{range: TextRange, text: string, selections:Array<TextRange>}>} */
    this._undoStack = [];
    /** @type {Array<{range: TextRange, text: string, selections:Array<TextRange>}>} */
    this._redoStack = [];
  }

  /**
   * @param {number} from
   * @param {number} to
   * @return {number}
   */
  charCountForLines(from, to) {
    var total = 0;
    for (var i = from; i <= to; i++) total += this._lines[i].length;
    return total;
  }

  /**
   * @param {number} i
   * @return {Line}
   */
  line(i) {
    return this._lines[i];
  }

  lineCount() {
    return this._lines.length;
  }

  /**
   * @param {Array<TextRange>} selections
   */
  setSelections(selections) {
    const previousSelections = this._selections;
    this._selections = selections;
    this.emit('selectionChanged', {
      selections,
      previousSelections
    });
  }

  get selections() {
    return this._selections;
  }

  /**
   * @param {TextRange=} range
   * @return {string}
   */
  text(range = this.fullRange()) {
    if (range.start.line === range.end.line)
      return this._lines[range.start.line].text.substring(range.start.column, range.end.column);

    var result =
      this._lines[range.start.line].text.substring(range.start.column) +
      this._lines[range.start.line].lineEnding +
      this._rasterizeLines(range.start.line + 1, range.end.line - 1) +
      this._lines[range.end.line].text.substring(0, range.end.column);
    return result;
  }

  /**
   * @param {number} from
   * @param {number} to
   * @return {string}
   */
  _rasterizeLines(from, to) {
    var text = '';
    var anchor = null;
    var end = 0;
    var start = 0;
    var lastLineEnding = null;
    for (var i = from; i <= to; i++) {
      if (anchor && end === this._lines[i]._start - lastLineEnding.length && this._lines[i]._sourceString === anchor) {
        end = this._lines[i]._end;
        lastLineEnding = this._lines[i].lineEnding;
        continue;
      }
      lastLineEnding = this._lines[i].lineEnding;
      if (anchor) {
        text += anchor.substring(start, end);
        anchor = null;
      }
      if (this._lines[i]._sourceString) {
        anchor = this._lines[i]._sourceString;
        start = this._lines[i]._start;
        end = this._lines[i]._end;
      } else {
        text += this._lines[i].text + this._lines[i].lineEnding;
      }
    }
    if (anchor) {
      text += anchor.substring(start, end) + '\n';
    }
    return text;
  }

  /**
   * @return {TextRange}
   */
  fullRange() {
    return {
      start: {
        line: 0,
        column: 0
      },
      end: {
        line: this._lines.length - 1,
        column: this._lines[this._lines.length - 1].length
      }
    };
  }

  /**
   * @param {string} text
   * @param {TextRange} range
   * @return {Loc}
   */
  replaceRange(text, range) {
    var replacedText = this.text(range);
    var endLocation = this._replaceRange(text, range);
    if (replacedText !== text) {
      this._undoStack.push({
        text: replacedText,
        range: {
          start: range.start,
          end: endLocation
        },
        selections: this._selections
      });
    }
    return endLocation;
  }

  /**
   * @param {string} text
   * @param {TextRange} range
   * @return {Loc}
   */
  _undoReplaceRange(text, range) {
    var replacedText = this.text(range);
    var endLocation = this._replaceRange(text, range);
    if (replacedText !== text) {
      this._redoStack.push({
        text: replacedText,
        range: {
          start: range.start,
          end: endLocation
        },
        selections: this._selections
      });
    }
    return endLocation;
  }

  /**
   * @param {string} text
   * @param {TextRange} range
   * @return {Loc}
   */
  _replaceRange(text, range) {
    var before = this._lines[range.start.line].text.substring(0, range.start.column);
    var after = this._lines[range.end.line].text.substring(range.end.column);
    var lines = this._createLines(before + text + after);
    var endColumn = lines[lines.length - 1].length - after.length;
    var amount = range.end.line - range.start.line + 1;
    var CHUNK = 20000;
    for (var i = 0; i < lines.length; i += CHUNK) {
      this._lines.splice(range.start.line + i, amount, ...lines.slice(i, i + CHUNK));
      amount = 0;
    }

    this.emit('change', range);
    return {
      line: range.start.line + lines.length - 1,
      column: endColumn
    };
  }

  /**
   * @return {boolean}
   */
  undo() {
    if (!this._undoStack.length) return false;
    var undoItem = this._undoStack.pop();
    this._undoReplaceRange(undoItem.text, undoItem.range);
    this.setSelections(undoItem.selections);
    return true;
  }

  /**
   * @return {boolean}
   */
  redo() {
    if (!this._redoStack.length) return false;
    var redoItem = this._redoStack.pop();
    this.replaceRange(redoItem.text, redoItem.range);
    this.setSelections(redoItem.selections);
    return true;
  }

  /**
   * @param {string} data
   * @return {Array<Line>}
   */
  _createLines(data) {
    /** @type {Array<Line>} */
    var lines = [];
    var start = 0;
    var end = -1;
    while (end < data.length) {
      start = end + 1;
      end = data.indexOf('\n', start);
      if (end === -1) end = data.length;
      if (data[end - 1] === '\r') lines.push(new Line(data, start, end - 1, '\r\n'));
      else lines.push(new Line(data, start, end, '\n'));
    }
    return lines;
  }
}

class Line {
  /**
   * @param {string} sourceString
   * @param {number} start
   * @param {number} end
   * @param {string} lineEnding
   */
  constructor(sourceString, start, end, lineEnding) {
    this._rasterized = false;
    this._start = start;
    this._end = end;
    this._text = null;
    this._sourceString = sourceString;
    this._lineEnding = lineEnding;
  }

  get lineEnding() {
    return this._lineEnding;
  }

  _rasterize() {
    if (this._rasterized) return;
    this._text = this._sourceString.substring(this._start, this._end);
    this._sourceString = null;
    this._rasterized = true;
  }

  /**
   * @return {string}
   */
  get text() {
    this._rasterize();
    return this._text;
  }

  get length() {
    return this._rasterized ? this._text.length : this._end - this._start;
  }
}

/**
 * @typedef {Object} Loc
 * @property {number} column
 * @property {number} line
 */

/**
 * @typedef {Object} TextRange
 * @property {Loc} start
 * @property {Loc} end
 */

/**
 * @param {TextRange} selection
 * @return {boolean}
 */
function isSelectionCollapsed(selection) {
  return selection.start.line === selection.end.line && selection.start.column === selection.end.column;
}

/**
 * @param {Loc} location
 * @return {Loc}
 */
function copyLocation(location) {
  return {
    line: location.line,
    column: location.column
  };
}

/**
 * @param {TextRange} a
 * @param {TextRange} b
 * @return {-1|0|1}
 */
function compareRange(a, b) {
  return compareLocation(a.start, b.start) || compareLocation(a.end, b.end);
}

/**
 * @param {Loc} a
 * @param {Loc} b
 * @return {-1|0|1}
 */
function compareLocation(a, b) {
  if (a.line !== b.line) return a.line > b.line ? 1 : -1;
  if (a.column !== b.column) return a.column > b.column ? 1 : -1;
  return 0;
}
