class SelectionManger extends Emitter {
  /**
   * @param {Renderer} renderer
   * @param {Model} model
   * @param {CommandManager} commandManager
   */
  constructor(renderer, model, commandManager) {
    super();
    this._renderer = renderer;
    this._commandManager = commandManager;
    this._model = model;
    /** @type {Loc} */
    this._anchor = this._model.selections[0].start;
    /** @type {{x: number, y: number}} */
    this._cursor = null;
    /** @type {Loc} */
    this._desiredLocation = null;
    this._renderer.on('contentMouseDown', this._contentMouseDown.bind(this));
    this._model.on('selectionChanged', () => {
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

    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, -1, 0), 'moveLeft', 'ArrowLeft');
    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, 1, 0), 'moveRight', 'ArrowRight');
    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, -1, 0, true), 'extendLeft', 'Shift+ArrowLeft');
    this._commandManager.addCommand(
      this.moveCursorHorizontal.bind(this, 1, 0, true),
      'extendRight',
      'Shift+ArrowRight'
    );
    this._commandManager.addCommand(this.moveCursorVertical.bind(this, -1), 'moveUp', 'ArrowUp');
    this._commandManager.addCommand(this.moveCursorVertical.bind(this, 1), 'moveDown', 'ArrowDown');
    this._commandManager.addCommand(this.moveCursorVertical.bind(this, -1, true), 'extendUp', 'Shift+ArrowUp');
    this._commandManager.addCommand(this.moveCursorVertical.bind(this, 1, true), 'extendDown', 'Shift+ArrowDown');
    this._commandManager.addCommand(
      () => this.moveCursor({ column: 0, line: this._model.selections[0].start.line }),
      'moveLineStart',
      'Home'
    );
    this._commandManager.addCommand(
      () => {
        var selection = this._model.selections[0];
        return this.moveCursor({ column: this._model.line(selection.end.line).text.length, line: selection.end.line });
      },
      'moveLineEnd',
      'End'
    );
    this._commandManager.addCommand(
      () => this.moveCursor({ column: 0, line: this._model.selections[0].start.line }, true),
      'extendLineStart',
      'Shift+Home'
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
      'Shift+End'
    );

    this._commandManager.addCommand(
      () => {
        var selection = this._model.selections[0];
        if (!isSelectionCollapsed(selection)) return false;
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
  }

  /**
   * @param {MouseEvent} event
   */
  _contentMouseDown(event) {
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
    var window = this._renderer.element.ownerDocument.defaultView;
    /** @type {function(MouseEvent)} */
    var mousemove = event => {
      this._cursor = {
        x: event.clientX,
        y: event.clientY
      };
      this._updateMouseSelection();
    };
    /** @type {function(MouseEvent)} */
    var mouseup = event => {
      window.removeEventListener('mousemove', mousemove, true);
      window.removeEventListener('mouseup', mouseup, true);
      this._renderer.off('scroll', scroll);
    };
    var scroll = () => {
      this._updateMouseSelection();
    };
    window.addEventListener('mousemove', mousemove, true);
    window.addEventListener('mouseup', mouseup, true);
    this._renderer.on('scroll', scroll);
  }

  _updateMouseSelection() {
    console.assert(!!this._cursor, 'cursor should be defined');
    console.assert(this._increment > 0 && this._increment <= 3, 'unknown increment');
    var head = this._renderer.locationFromPoint(this._cursor.x, this._cursor.y);
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
        for (var i = endColumn + 1; i <= text.length && type === this._charType(text[i - 1]); i++) endColumn = i;
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
      if (end.line === this._model.lineCount()) {
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

  /**
   * @param {string} character
   * @return {-1|0|1|2}
   */
  _charType(character) {
    if (character.match(/\s/)) return 0;
    if (character.match(/[_0-9a-zA-Z]/)) return 1;
    if (character) return 2;
    return -1;
  }

  selectAll() {
    this._model.setSelections([this._model.fullRange()]);
  }

  /**
   * @param {-1|1} direction
   * @param {boolean} extend
   * @return {boolean}
   */
  _startIsHead(direction, extend) {
    if (!extend) return direction < 0;
    var selection = this._model.selections[0];
    var anchorIsStart = !!this._anchor && !compareLocation(this._anchor, selection.start);
    var anchorIsEnd = !!this._anchor && !compareLocation(this._anchor, selection.end);
    if (anchorIsStart === anchorIsEnd) return direction < 0;
    return !anchorIsStart;
  }

  /**
   * @param {1|-1} direction
   * @param {0} increment
   * @param {boolean=} extend
   * @return {boolean}
   */
  moveCursorHorizontal(direction, increment, extend) {
    var selection = this._model.selections[0];
    var modifyStart = this._startIsHead(direction, extend);

    var point = modifyStart ? copyLocation(selection.start) : copyLocation(selection.end);
    var { text } = this._model.line(point.line);
    if ((isSelectionCollapsed(selection) || extend) && increment === 0) point.column += direction;
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
    return this.moveCursor(point, extend);
  }

  /**
   * @param {1|-1} direction
   * @param {boolean=} extend
   * @return {boolean}
   */
  moveCursorVertical(direction, extend) {
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

  /**
   * @param {Loc} point
   * @param {boolean=} extend
   * @return {boolean}
   */
  moveCursor(point, extend) {
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
}
