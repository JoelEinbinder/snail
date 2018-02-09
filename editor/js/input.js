class Input extends Emitter {
  /**
   * @param {HTMLElement} parent
   * @param {Model} model
   * @param {CommandManager} commandManager
   * @param {boolean=} readOnly
   */
  constructor(parent, model, commandManager, readOnly) {
    super();
    parent.addEventListener('focus', this.focus.bind(this), false);
    this._model = model;
    this._commandManager = commandManager;
    this._buffer = '';
    this._bufferRange = {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 }
    };
    this._editable = !readOnly;
    this._textarea = document.createElement('textarea');
    this._textarea.style.whiteSpace = 'pre';
    this._textarea.style.resize = 'none';
    this._textarea.style.overflow = 'hidden';
    this._textarea.style.position = 'absolute';
    this._textarea.style.left = '-999em';
    this._textarea.style.opacity = '0';
    this._textarea.addEventListener('input', this.update.bind(this), false);
    this._textarea.readOnly = !this._editable;
    this._textarea.spellcheck = false;
    this._textarea.setAttribute('autocomplete', 'off');
    this._textarea.setAttribute('autocorrect', 'off');
    this._textarea.setAttribute('autocapitalize', 'off');
    this._textarea.addEventListener('copy', this._onCopy.bind(this), false);
    this._textarea.addEventListener('cut', this._onCut.bind(this), false);

    this._setupContextMenuListeners(parent);

    parent.appendChild(this._textarea);

    model.on('selectionChanged', this._selectionChanged.bind(this));
    this._commandManager.addCommand(this._deleteChar.bind(this, true), 'backspace', 'Backspace');
    this._commandManager.addCommand(this._deleteChar.bind(this, false), 'delete', 'Delete');
  }

  /**
   * @param {HTMLElement} parent
   */
  _setupContextMenuListeners(parent) {
    parent.addEventListener('mouseup', event => {
      if (event.which !== 3) return;
      this._textarea.style.left = event.layerX - 1 + 'px';
      this._textarea.style.top = event.layerY - 1 + 'px';
      this._textarea.style.zIndex = '1000';
      var valueNeedsReset = false;
      if (!this._textarea.value) {
        this._textarea.value = '<BLANK LINE>';
        valueNeedsReset = true;
      }
      var state = {
        start: this._textarea.selectionStart,
        end: this._textarea.selectionEnd,
        value: this._textarea.value
      };
      var done = () => {
        parent.removeEventListener('mousemove', checkDone, true);
        parent.removeEventListener('keydown', checkDone, true);
        window.removeEventListener('blur', checkDone, true);
        clearInterval(selectAllInterval);
      };
      var checkDone = () => {
        if (!checkSelectAll() && valueNeedsReset) this._textarea.value = '';
        done();
      };
      var checkSelectAll = () => {
        if (state.value !== this._textarea.value) return true;
        if (this._textarea.selectionStart < state.start || this._textarea.selectionEnd > state.end) {
          this._model.setSelections([this._model.fullRange()]);
          done();
          return true;
        }
        return false;
      };
      var selectAllInterval = setInterval(checkSelectAll, 100);
      parent.addEventListener('mousemove', checkDone, true);
      parent.addEventListener('keydown', checkDone, true);
      window.addEventListener('blur', checkDone, true);
      var cleanup = () => {
        this._textarea.style.left = '-999em';
        this._textarea.style.removeProperty('z-index');
        cancelAnimationFrame(raf);
      };
      var raf = requestAnimationFrame(cleanup);
    });
  }

  /**
   * @param {{selections: Array<TextRange>, previousSelections: Array<TextRange>}} event
   */
  _selectionChanged(event) {
    var mainSelection = event.selections[0];
    this._bufferRange = {
      start: { line: mainSelection.start.line, column: 0 },
      end: {
        line: mainSelection.end.line,
        column: this._model.line(mainSelection.end.line).text.length
      }
    };
    this._buffer = this._model.text(this._bufferRange);
    if (this._buffer.length > 1000) {
      this._buffer = '...Content too long...';
      this._textarea.value = this._buffer;
      this._textarea.setSelectionRange(0, this._buffer.length);
      return;
    }
    this._textarea.value = this._buffer;
    this._textarea.setSelectionRange(
      mainSelection.start.column - this._bufferRange.start.column,
      this._buffer.length - this._bufferRange.end.column + mainSelection.end.column
    );
  }

  /**
   * @param {ClipboardEvent} event
   */
  _onCopy(event) {
    event.clipboardData.setData('text/plain', this._selectionsText());
    event.preventDefault();
  }

  /**
   * @param {ClipboardEvent} event
   */
  _onCut(event) {
    if (this._editable) return; // todo actually cut
    event.preventDefault();
  }

  /**
   * @param {!Event} event
   */
  _onKeyDown(event) {}

  /**
   * @return {string}
   */
  _selectionsText() {
    return this._model.selections.map(selection => this._model.text(selection)).join('\n');
  }

  update(event) {
    var value = this._textarea.value;
    var buffer = this._buffer;
    if (value === buffer) return;
    var start = copyLocation(this._bufferRange.start);
    var selectionStart = this._textarea.selectionStart;
    var selectionEnd = this._textarea.selectionEnd;
    for (var i = 0; i < selectionStart; i++) {
      if (value[i] !== buffer[i]) break;
      start.column++;
      if (value[i] === '\n') {
        start.line++;
        start.column = 0;
      }
    }
    var end = copyLocation(this._bufferRange.end);
    for (var j = value.length - 1; j >= selectionEnd; j--) {
      if (value[j] !== buffer[j - value.length + buffer.length]) break;
      end.column--;
      if (value[j] === '\n') {
        end.line--;
        end.column = this._model.line(end.line).text.length;
      }
    }
    var loc = this._model.replaceRange(value.substring(i, j + 1), { start, end });
    this._model.setSelections([{ start: loc, end: loc }]);
  }

  focus() {
    this._textarea.focus();
  }

  /**
   * @param {boolean} backwards
   * @return {boolean}
   */
  _deleteChar(backwards) {
    var range = this._model.selections[0];
    if (isSelectionCollapsed(range)) {
      var line = range.start.line;
      var column = range.start.column;
      if (backwards) {
        column--;
        if (column < 0) {
          line--;
          if (line < 0) {
            line = 0;
            column = 0;
          } else {
            column = this._model.line(line).text.length;
          }
        }
        range = {
          start: {
            line,
            column
          },
          end: range.start
        };
      } else {
        column++;
        if (column > this._model.line(line).text.length) {
          line++;
          if (line >= this._model.lineCount()) {
            line = this._model.lineCount() - 1;
            column = this._model.line(line).text.length;
          } else {
            column = 0;
          }
        }
        range = {
          start: range.start,
          end: {
            line,
            column
          }
        };
      }
    }
    this._model.replaceRange('', range);
    this._model.setSelections([{ start: range.start, end: range.start }]);

    return true;
  }
}
