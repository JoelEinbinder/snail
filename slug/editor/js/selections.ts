import { Emitter } from "./emitter";
import {
  compareLocation, compareRange, copyLocation, isSelectionCollapsed,
  TextRange,
  type Loc, type Model
} from "./model";
import type { Renderer } from './renderer';
import type { CommandManager } from './commands';
export class SelectionManger extends Emitter {
  private _anchor: any;
  private _cursor: {x: number, y: number}| null = null;
  private _desiredLocation: Loc|null = null;
  private _increment: number;
  constructor(private _renderer: Renderer, private _model: Model, private _commandManager: CommandManager) {
    super();
    this._anchor = this._model.selections[0].start;
    this._renderer.on('contentMouseDown', this._contentMouseDown.bind(this));
    this._model.on('selection-changed', () => {
      this._anchor = this._model.selections[0].start;
      this._desiredLocation = null;
    });

    this._commandManager.addCommand(
      () => {
        this.selectAll();
        return true;
      },
      'selectAll',
      'Ctrl+A',
      'Meta+A'
    );

    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, -1, { extend: false }), 'moveLeft', 'ArrowLeft');
    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, 1, { extend: false }), 'moveRight', 'ArrowRight');
    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, -1, { extend: true }), 'extendLeft', 'Shift+ArrowLeft');
    this._commandManager.addCommand(
      this.moveCursorHorizontal.bind(this, 1, { extend: true }),
      'extendRight',
      'Shift+ArrowRight'
    );
    this._commandManager.addCommand(this.moveCursorVertical.bind(this, -1, false), 'moveUp', 'ArrowUp');
    this._commandManager.addCommand(this.moveCursorVertical.bind(this, 1, false), 'moveDown', 'ArrowDown');
    this._commandManager.addCommand(this.moveCursorVertical.bind(this, -1, true), 'extendUp', 'Shift+ArrowUp');
    this._commandManager.addCommand(this.moveCursorVertical.bind(this, 1, true), 'extendDown', 'Shift+ArrowDown');
    this._commandManager.addCommand(
      () => this.moveCursor({ column: 0, line: this._model.selections[0].start.line }, false),
      'moveLineStart',
      'Home',
      ['Home', 'Ctrl+A', 'Meta+ArrowLeft'],
    );
    this._commandManager.addCommand(
      () => {
        var selection = this._model.selections[0];
        return this.moveCursor({ column: this._model.line(selection.end.line).text.length, line: selection.end.line });
      },
      'moveLineEnd',
      'End',
      ['End', 'Ctrl+E', 'Meta+ArrowRight'],
    );
    this._commandManager.addCommand(
      () => this.moveCursor({ column: 0, line: this._model.selections[0].start.line }, true),
      'extendLineStart',
      'Shift+Home',
      ['Shift+Home', 'Shift+Ctrl+A', 'Meta+Shift+ArrowLeft'],
    );
    this._commandManager.addCommand(
      () => {
        var selection = this._model.selections[0];
        return this.moveCursor(
          { column: this._model.line(selection.end.line).text.length, line: selection.end.line },
          true
        );
      },
      'extendLineEnd',
      'Shift+End',
      ['Shift+End', 'Shift+Ctrl+E', 'Meta+Shift+ArrowRight'],
    );
    this._commandManager.addCommand(
      () => {
        const selection = this._model.selections[0];
        if (!isSelectionCollapsed(selection)) {
          this._model.replaceRange('', selection);
          this.moveCursor(selection.start);
          return true;
        }
        this._model.replaceRange('', {
          start: selection.start,
          end: {
            line: selection.start.line,
            column: Infinity
          }
        });
        return true;
      },
      'deleteToEndOfLine',
      'Ctrl+K',
    );
    this._commandManager.addCommand(
      () => {
        const selection = this._model.selections[0];
        if (!isSelectionCollapsed(selection)) {
          this._model.replaceRange('', selection);
          this.moveCursor(selection.start);
          return true;
        }
        const start = {
          line: selection.start.line,
          column: 0
        };
        this._model.replaceRange('', {
          start,
          end: selection.start,
        });
        this.moveCursor(start);
        return true;
      },
      'deleteToStartOfLine',
      'Ctrl+U',
    );

    this._commandManager.addCommand(() => {
      var selection = this._model.selections[0];
      var text = this._model.line(selection.start.line).text;
      var column = selection.start.column;
      var left = text.slice(0, column).search(/[A-Za-z0-9_]+$/);
      if (left < 0) left = column;

      var right = text.slice(column).search(/[^A-Za-z0-9_]/) + column;
      if (right < column) right = text.length;
      this._model.setSelections([
        {
          start: {
            line: selection.start.line,
            column: left
          },
          end: {
            line: selection.end.line,
            column: right
          }
        }
      ]);
      return true;
    }, 'selectWord');

    this._commandManager.addCommand(
      () => {
        const selection = this._model.selections[0];
        if (isSelectionCollapsed(selection)) return this._commandManager.trigger('selectWord');
        const needle = this._model.text(selection);
        let nextLocation = this._model.search(needle, this._model.selections[this._model.selections.length - 1].end);
        if (!nextLocation) nextLocation = this._model.search(needle)!;
        if (compareLocation(nextLocation, selection.start) === 0) return true; // we wrapped around to the start
        const selections = this._model.selections.slice(0);
        const end = {
          line: nextLocation.line,
          column: nextLocation.column + needle.length
        };
        selections.push({
          start: nextLocation,
          end
        });
        this._model.setSelections(selections);
        this._renderer.scrollLocationIntoView(end);
        return true;
      },
      'selectNext',
      'Ctrl+D',
      'Meta+D'
    );

    this._commandManager.addCommand(
      () => {
        this._model.undo();
        return true;
      },
      'undo',
      'Ctrl+Z',
      'Meta+Z'
    );
    this._commandManager.addCommand(
      () => {
        this._model.redo();
        return true;
      },
      'redo',
      'Ctrl+Y',
      'Meta+Shift+Z'
    );
    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, -1, { extend: false, byWord: true }), 'moveWordLeft', 'Ctrl+ArrowLeft', 'Alt+ArrowLeft');
    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, 1, { extend: false, byWord: true }), 'moveWordRight', 'Ctrl+ArrowRight', 'Alt+ArrowRight');
    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, -1, { extend: true, byWord: true }), 'extendWordLeft', 'Shift+Ctrl+ArrowLeft', 'Alt+Shift+ArrowLeft');
    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, 1, { extend: true, byWord: true }), 'extendWordRight', 'Shift+Ctrl+ArrowRight', 'Alt+Shift+ArrowRight');
    this._commandManager.addCommand(
      () => {
        if (this._model.selections.length === 1 && isSelectionCollapsed(this._model.selections[0]))
          return false;
        this._model.setSelections([{
          start: this._model.selections[0].end,
          end: this._model.selections[0].end,
        }]);
        return true;
      },
      'collapseSelection',
      'Escape',
    );
  }

  _contentMouseDown(event: MouseEvent) {
    if (event.which !== 1) return;
    if (event.detail >= 4) {
      this.selectAll();
      return;
    }
    this._increment = event.detail;
    this._cursor = {
      x: event.clientX,
      y: event.clientY
    };
    if (!event.shiftKey) this._anchor = this._renderer.locationFromPoint(this._cursor.x, this._cursor.y);
    this._updateMouseSelection();
    this._trackDrag();
  }

  _trackDrag() {
    // We have to listen on the window so that you can select outside the bounds
    const window = this._renderer.element.ownerDocument.defaultView!;
    const mousemove: (arg0: MouseEvent) => void = (event): void => {
      this._cursor = {
        x: event.clientX,
        y: event.clientY
      };
      this._updateMouseSelection();
    };
    const mouseup: (arg0: MouseEvent) => void = (event): void => {
      window.removeEventListener('mousemove', mousemove, true);
      window.removeEventListener('mouseup', mouseup, true);
      this._renderer.off('scroll', scroll);
    };
    const scroll = () => {
      this._updateMouseSelection();
    };
    window.addEventListener('mousemove', mousemove, true);
    window.addEventListener('mouseup', mouseup, true);
    this._renderer.on('scroll', scroll);
  }

  _updateMouseSelection() {
    console.assert(!!this._cursor, 'cursor should be defined');
    console.assert(this._increment > 0 && this._increment <= 3, 'unknown increment');
    var head = this._renderer.locationFromPoint(this._cursor!.x, this._cursor!.y);
    var anchor = this._anchor;
    var start, end;
    if (head.line < anchor.line || (head.line === anchor.line && head.column < anchor.column)) {
      start = head;
      end = anchor;
    } else {
      end = head;
      start = anchor;
    }
    if (this._increment === 1) {
      this._model.setSelections([
        {
          start: {
            line: start.line,
            column: start.column
          },
          end: {
            line: end.line,
            column: end.column
          }
        }
      ]);
    } else if (this._increment === 2) {
      var startColumn = start.column;
      var { text } = this._model.line(start.line);
      if (startColumn > 0 && startColumn < text.length) {
        var type = this._charType(text[startColumn]);
        for (var i = startColumn - 1; i >= 0 && type === this._charType(text[i]); i--) startColumn = i;
      }

      var endColumn = end.column;
      var { text } = this._model.line(end.line);
      if (endColumn < text.length) {
        var type = this._charType(text[endColumn]);
        for (let i = endColumn + 1; i <= text.length && type === this._charType(text[i - 1]); i++) endColumn = i;
      }

      this._model.setSelections([
        {
          start: {
            line: start.line,
            column: startColumn
          },
          end: {
            line: end.line,
            column: endColumn
          }
        }
      ]);
    } else if (this._increment === 3) {
      if (end.line === this._model.lineCount() - 1) {
        this._model.setSelections([
          {
            start: {
              line: start.line,
              column: 0
            },
            end: {
              line: end.line,
              column: this._model.line(end.line).length
            }
          }
        ]);
      } else {
        this._model.setSelections([
          {
            start: {
              line: start.line,
              column: 0
            },
            end: {
              line: end.line + 1,
              column: 0
            }
          }
        ]);
      }
    }
    this._anchor = anchor;
    this._desiredLocation = head;
    this._renderer.scrollLocationIntoView(head);
    this._renderer.highlightWordOccurrences();
  }

  _charType(character: string): -1 | 0 | 1 | 2 {
    if (character.match(/\s/)) return 0;
    if (character.match(/[_0-9a-zA-Z]/)) return 1;
    if (character) return 2;
    return -1;
  }

  selectAll() {
    this._model.setSelections([this._model.fullRange()]);
  }

  _startIsHead(direction: -1 | 1, extend: boolean): boolean {
    if (!extend) return direction < 0;
    var selection = this._model.selections[0];
    var anchorIsStart = !!this._anchor && !compareLocation(this._anchor, selection.start);
    var anchorIsEnd = !!this._anchor && !compareLocation(this._anchor, selection.end);
    if (anchorIsStart === anchorIsEnd) return direction < 0;
    return !anchorIsStart;
  }

  moveCursorHorizontal(direction: 1 | -1, {extend, byWord}: {extend: boolean, byWord?: boolean}): boolean {
    const modifyStart = this._startIsHead(direction, extend);
    const points: Loc[] = [];
    for (const selection of this._model.selections) {
      var point = modifyStart ? copyLocation(selection.start) : copyLocation(selection.end);
      var { text } = this._model.line(point.line);
      if (isSelectionCollapsed(selection) || extend) {
        if (byWord) {
          let seenWordChar = false;
          point.column += direction;
          while (point.column >= 0 && point.column < text.length) {
            const isWordChar = /[A-Za-z0-9_]/.test(text[point.column]);
            if (!isWordChar) {
              if (seenWordChar) {
                if (direction === -1)
                  point.column += 1;
                break;
              }
            } else {
              seenWordChar = true;
            }
            point.column += direction;
          }
        } else {
          point.column += direction;
        }
      }
      if (point.column < 0) {
        point.line--;
        if (point.line < 0) {
          point.line = 0;
          point.column = 0;
        } else point.column = this._model.line(point.line).text.length;
      } else if (point.column > text.length) {
        point.line++;
        if (point.line >= this._model.lineCount()) {
          point.line = this._model.lineCount() - 1;
          point.column = text.length;
        } else {
          point.column = 0;
        }
      }
      points.push(point);
    }
    return this.moveCursors(points, extend);
  }

  moveCursorVertical(direction: 1 | -1, extend: boolean): boolean {
    var selection = this._model.selections[0];
    var modifyStart = this._startIsHead(direction, extend);

    var point = modifyStart ? copyLocation(selection.start) : copyLocation(selection.end);
    var desiredLocation = copyLocation(this._desiredLocation || point);
    point.line += direction;
    desiredLocation.line = point.line;
    if (point.line < 0) {
      point.line = 0;
      point.column = 0;
    } else if (point.line >= this._model.lineCount()) {
      point.line = this._model.lineCount() - 1;
      point.column = this._model.line(point.line).text.length;
    } else {
      point.column = Math.min(desiredLocation.column, this._model.line(point.line).text.length);
    }
    if (!this.moveCursor(point, extend)) return false;
    this._desiredLocation = desiredLocation;
    return true;
  }

  moveCursor(point: Loc, extend?: boolean): boolean {
    var selection = this._model.selections[0];
    var anchor = extend ? this._anchor || point : point;
    if (compareLocation(point, anchor) < 0) selection = { start: point, end: anchor };
    else selection = { start: anchor, end: point };

    if (this._model.selections.length === 1 && !compareRange(this._model.selections[0], selection)) return false;
    this._model.setSelections([selection]);
    this._anchor = anchor;
    this._desiredLocation = point;
    this._renderer.scrollLocationIntoView(point);
    this._renderer.highlightWordOccurrences();
    return true;
  }

  moveCursors(points: Loc[], extend?: boolean): boolean {
    if (points.length !== this._model.selections.length)
      throw new Error('points.length !== this._model.selections.length');
    let moved = false;
    let desiredLocation: Loc|null = null;
    const newSelections: TextRange[] = [];
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const selection = this._model.selections[i];
      const anchor = extend ? this._anchor || point : point;
      const newSelection = compareLocation(point, anchor) < 0 ?
        { start: point, end: anchor } :
        { start: anchor, end: point };
      if (compareRange(selection, newSelection) !== 0) moved = true;
      newSelections.push(newSelection);
      if (i === 0) {
        this._anchor = anchor;
        desiredLocation = point;
      }
    }
    if (!moved)
      return false;
    this._model.setSelections(newSelections);
    this._desiredLocation = desiredLocation;
    this._renderer.scrollLocationIntoView(this._desiredLocation!);
    this._renderer.highlightWordOccurrences();
    return true;
  }
}
