import { Emitter } from "./emitter";

export class Model extends Emitter<{
  'selection-changed': { selections: TextRange[], previousSelections: TextRange[]},
  'squiggliesChanged': void,
  'change': { range: TextRange, text: string },
}> {
  private _lines: Line[];
  private _selections: TextRange[] = [{ start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }];
  private _undoStack: {range: TextRange, text: string, selections:TextRange[]}[] = [];
  private _redoStack: {range: TextRange, text: string, selections:TextRange[]}[] = [];
  private _squigglies: {range: TextRange, color: string}[] = [];

  constructor(data: string) {
    super();
    this._lines = this._createLines(data);
  }

  charCountForLines(from: number, to: number): number {
    var total = 0;
    for (var i = from; i <= to; i++) total += this._lines[i].length;
    return total;
  }

  line(i: number): Line {
    return this._lines[i];
  }

  lineCount() {
    return this._lines.length;
  }

  setSelections(selections: TextRange[]) {
    const previousSelections = this._selections;
    this._selections = selections;
    this.emit('selection-changed', {
      selections,
      previousSelections
    });
  }

  get selections() {
    return this._selections;
  }

  get squigglies() {
    return this._squigglies;
  }

  addSquiggly(range: TextRange, color: string) {
    this._squigglies.push({
      range,
      color
    });
    this.emit('squiggliesChanged', undefined);
  }

  text(range: TextRange | undefined = this.fullRange()): string {
    const clippedRange = this.clipRange(range);
    if (clippedRange.start.line === clippedRange.end.line)
      return this._lines[clippedRange.start.line].text.substring(clippedRange.start.column, clippedRange.end.column);

    var result =
      this._lines[clippedRange.start.line].text.substring(clippedRange.start.column) +
      this._lines[clippedRange.start.line].lineEnding +
      this._rasterizeLines(clippedRange.start.line + 1, clippedRange.end.line - 1) +
      this._lines[clippedRange.end.line].text.substring(0, clippedRange.end.column);
    return result;
  }

  _rasterizeLines(from: number, to: number): string {
    var text = '';
    var anchor = '';
    var end = 0;
    var start = 0;
    var lastLineEnding = '';
    for (var i = from; i <= to; i++) {
      if (!this._lines[i])
        continue;
      if (end === this._lines[i]._start - lastLineEnding.length && this._lines[i]._sourceString === anchor) {
        end = this._lines[i]._end;
        lastLineEnding = this._lines[i].lineEnding;
        continue;
      }
      text += anchor.substring(start, end) + lastLineEnding;
      lastLineEnding = this._lines[i].lineEnding;
      anchor = this._lines[i]._sourceString;
      start = this._lines[i]._start;
      end = this._lines[i]._end;
    }
    text += anchor.substring(start, end) + lastLineEnding;
    return text;
  }

  fullRange(): TextRange {
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

  replaceRange(text: string, range: TextRange): Loc {
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

  _undoReplaceRange(text: string, range: TextRange): Loc {
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

  _replaceRange(text: string, range: TextRange): Loc {
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

    this.emit('change', {range, text});
    return {
      line: range.start.line + lines.length - 1,
      column: endColumn
    };
  }

  undo(): boolean {
    if (!this._undoStack.length) return false;
    const undoItem = this._undoStack.pop()!;
    this._undoReplaceRange(undoItem.text, undoItem.range);
    this.setSelections(undoItem.selections);
    return true;
  }

  redo(): boolean {
    if (!this._redoStack.length) return false;
    const redoItem = this._redoStack.pop()!;
    this.replaceRange(redoItem.text, redoItem.range);
    this.setSelections(redoItem.selections);
    return true;
  }

  clipRange(range: TextRange): TextRange {
    const copy = {start:{...range.start}, end:{...range.end}};
    if (copy.start.line < 0) {
      copy.start.line = 0;
      copy.start.column = 0;
    } else if (copy.start.line > this._lines.length - 1) {
      copy.start.line = this._lines.length - 1;
      copy.start.column = this._lines[this._lines.length - 1].length;
    } else if (copy.start.column < 0) {
      copy.start.column = 0;
    } else if (copy.start.column > this._lines[copy.start.line].length) {
      copy.start.column = this._lines[copy.start.line].length;
    }

    if (copy.end.line < 0) {
      copy.end.line = 0;
      copy.end.column = 0;
    } else if (copy.end.line > this._lines.length - 1) {
      copy.end.line = this._lines.length - 1;
      copy.end.column = this._lines[this._lines.length - 1].length;
    } else if (copy.end.column < 0) {
      copy.end.column = 0;
    } else if (copy.end.column > this._lines[copy.end.line].length) {
      copy.end.column = this._lines[copy.end.line].length;
    }
    return copy;
  }

  _createLines(data: string): Array<Line> {
    /** @type {Array<Line>} */
    var lines: Array<Line> = [];
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

  search(needle: string, from: Loc = { line: 0, column: 0 }): Loc | null {
    let { line, column } = from;
    let index;
    while (line < this._lines.length) {
      index = this._lines[line].text.indexOf(needle, column);
      if (index !== -1) return { line, column: index };
      column = 0;
      line++;
    }
    return null;
  }
}

export class Line {
  private _rasterized = false;
  private _text: string|null = null;
  constructor(
    public _sourceString: string,
    public _start: number,
    public _end: number,
    private _lineEnding: string,
  ) { }

  get lineEnding() {
    return this._lineEnding;
  }

  _rasterize() {
    if (this._rasterized) return;
    this._text = this._sourceString.substring(this._start, this._end);
    this._sourceString = this._text;
    this._start = 0;
    this._end = this._text.length;
    this._rasterized = true;
  }

  get text(): string {
    this._rasterize();
    return this._text!;
  }

  get length() {
    return this._rasterized ? this._text!.length : this._end - this._start;
  }
}

export type Loc = {
  column: number;
  line: number;
};

export type TextRange = {
  start: Loc;
  end: Loc;
};

export function isSelectionCollapsed(selection: TextRange): boolean {
  return selection.start.line === selection.end.line && selection.start.column === selection.end.column;
}

export function copyLocation(location: Loc): Loc {
  return {
    line: location.line,
    column: location.column
  };
}

export function compareRange(a: TextRange, b: TextRange): -1 | 0 | 1 {
  return compareLocation(a.start, b.start) || compareLocation(a.end, b.end);
}

export function compareLocation(a: Loc, b: Loc): -1 | 0 | 1 {
  if (a.line !== b.line) return a.line > b.line ? 1 : -1;
  if (a.column !== b.column) return a.column > b.column ? 1 : -1;
  return 0;
}
