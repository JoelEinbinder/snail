class Model extends Emitter {
  /**
   * @param {string} data
   */
  constructor(data) {
    super();
    this._lines = this._createLines(data);
    /** @type {Array<TextRange>} */
    this._selections = [{ start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }];
  }

  /**
   * @param {number} from
   * @param {number} to
   * @return {number}
   */
  charCountForLines(from, to) {
    var total = 0;
    for (var i = from; i <= to; i++) total += this._lines[i].text.length;
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
    var content = this._lines.slice(range.start.line, range.end.line + 1).map(line => line.text);
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
        column: this._lines[this._lines.length - 1].text.length
      }
    };
  }

  /**
   *
   * @param {string} text
   * @param {TextRange} range
   * @return {Loc}
   */
  replaceRange(text, range) {
    var lines = this._createLines(text);
    lines[0].text = this._lines[range.start.line].text.substring(0, range.start.column) + lines[0].text;
    var endColumn = lines[lines.length - 1].text.length;
    lines[lines.length - 1].text += this._lines[range.end.line].text.substring(range.end.column);
    this._lines.splice(range.start.line, range.end.line - range.start.line + 1, ...lines);

    this.emit('change', range);
    return {
      line: range.start.line + lines.length - 1,
      column: endColumn
    };
  }

  /**
   * @param {string} data
   * @return {Array<Line>}
   */
  _createLines(data) {
    return data
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map(text => ({ text }));
  }
}

/**
 * @typedef {Object} Line
 * @property {string} text
 */

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
