class SelectionManger extends Emitter {
  /**
   * @param {Editor} renderer
   * @param {Model} model
   * @param {CommandManager} commandManager
   */
  constructor(renderer, model, commandManager) {
    super();
    this._renderer = renderer;
    this._commandManager = commandManager;
    this._model = model;
    this._anchor = null;
    this._cursor = null;
    this._renderer.on('contentMouseDown', this._contentMouseDown.bind(this));

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
    this._commandManager.addCommand(this.moveCursorHorizontal.bind(this, 1, 0, true), 'extendRight', 'Shift+ArrowRight');
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
    this._anchor = null;
    this._update();
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
      this._update();
    };
    /** @type {function(MouseEvent)} */
    var mouseup = event => {
      window.removeEventListener('mousemove', mousemove, true);
      window.removeEventListener('mouseup', mouseup, true);
      this._renderer.off('scroll', scroll);
    };
    var scroll = () => {
      this._update();
    };
    window.addEventListener('mousemove', mousemove, true);
    window.addEventListener('mouseup', mouseup, true);
    this._renderer.on('scroll', scroll);
  }

  _update() {
    console.assert(!!this._cursor, 'cursor should be defined');
    console.assert(this._increment > 0 && this._increment <= 3, 'unknown increment');
    var head = this._renderer.locationFromPoint(this._cursor.x, this._cursor.y);
    if (!this._anchor) this._anchor = head;
    var start, end;
    if (head.line < this._anchor.line || (head.line === this._anchor.line && head.column < this._anchor.column)) {
      start = head;
      end = this._anchor;
    } else {
      end = head;
      start = this._anchor;
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
      var text = this._model.line(start.line);
      if (startColumn > 0 && startColumn < text.length) {
        var type = this._charType(text[startColumn]);
        for (var i = startColumn - 1; i >= 0 && type === this._charType(text[i]); i--) startColumn = i;
      }

      var endColumn = end.column;
      text = this._model.line(end.line);
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
    }
    this._renderer.scrollLocationIntoView(head);
  }

  /**
   * @param {string} character
   * @return {-1|0|1|2}
   */
  _charType(character) {
    if (character.match(/\s/)) return 0;
    if (character.match(/[0-9a-zA-Z]/)) return 1;
    if (character) return 2;
    return -1;
  }

  selectAll() {
    this._model.setSelections([this._model.fullRange()]);
  }

  /**
   * @param {1|-1} direction
   * @param {0} increment
   * @param {boolean=} extend
   * @return {boolean}
   */
  moveCursorHorizontal(direction, increment, extend) {
    var selection = this._model.selections[0];
    var modifyStart;
    var anchorIsStart = !compareLocation(this._anchor, selection.start);
    var anchorIsEnd = !compareLocation(this._anchor, selection.end)
    if (anchorIsStart === anchorIsEnd)
      modifyStart = direction < 0;
    else
      modifyStart = !anchorIsStart;

    var point = modifyStart ? copyLocation(selection.start) : copyLocation(selection.end);
    var text = this._model.line(point.line);
    if (increment === 0)
      point.column += direction;
    if (point.column < 0) {
      point.line--;
      if (point.line < 0) {
        point.line = 0;
        point.column = 0;
      } else
        point.column = this._model.line(point.line).length;
    } else if (point.column > text.length) {
      point.line++;
      if (point.line >= this._model.lineCount()) {
        point.line = this._model.lineCount() - 1;
        point.column = text.length;
      } else {
        point.column = 0;
      }
    }
    if (!extend) {
      selection = { start: point, end: point };
      this._anchor = point;
    } else if (modifyStart)
      selection = { start: point, end: selection.end };
    else
      selection = { start: selection.start, end: point };
    if (this._model.selections.length === 1 && !compareRange(this._model.selections[0], selection))
      return false;
    this._model.setSelections([selection]);
    this._renderer.scrollLocationIntoView(point);
    return true;
  }
}
