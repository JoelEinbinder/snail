class Model extends Emitter {
  /**
   * @param {string} data
   */
  constructor(data) {
    super();
    this._lines = data.split('\n');
    this._longestLineLength = 0;
    for (var line of this._lines) this._longestLineLength = Math.max(this._longestLineLength, line.length);

    /** @type {Array<TextRange>} */
    this._selections = [{ start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }];
  }

  longestLineLength() {
    return this._longestLineLength;
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
   * @return {string}
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
    const previousSelections = selections;
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
      return this._lines[range.start.line].substring(range.start.column, range.end.column);
    var content = this._lines.slice(range.start.line, range.end.line + 1);
    content[0] = content[0].substring(range.start.column);
    content[content.length - 1] = content[content.length - 1].substring(0, range.end.column);
    return content.join('\n');
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
   *
   * @param {string} text
   * @param {TextRange} range
   */
  replaceRange(text, range) {
    throw 'todo';
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
  if (a.line !== b.line)
    return a.line > b.line ? 1 : -1;
  if (a.column !== b.column)
    return a.column > b.column ? 1 : -1;
  return 0;
}