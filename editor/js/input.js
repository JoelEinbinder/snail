import { Emitter } from "./emitter";
import { compareLocation, compareRange, copyLocation, isSelectionCollapsed } from "./model.js";

export class Input extends Emitter {
  /**
   * @param {HTMLElement} parent
   * @param {import('./model').Model} model
   * @param {import('./commands').CommandManager} commandManager
   * @param {import('./renderer').Renderer} renderer
   * @param {boolean=} readOnly
   */
  constructor(parent, model, commandManager, renderer, readOnly) {
    super();
    parent.addEventListener('focus', this.focus.bind(this), false);
    this._model = model;
    this._commandManager = commandManager;
    this._renderer = renderer;
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
    this._overrideBigSurDoubleSpacePeriod();
    this._textarea.addEventListener('input', this.update.bind(this), false);
    this._textarea.readOnly = !this._editable;
    this._textarea.spellcheck = false;
    this._textarea.setAttribute('autocomplete', 'off');
    this._textarea.setAttribute('autocorrect', 'off');
    this._textarea.setAttribute('autocapitalize', 'off');
    this._textarea.addEventListener('copy', this._onCopy.bind(this), false);
    this._textarea.addEventListener('cut', this._onCut.bind(this), false);
    this._textarea.addEventListener('paste', this._onPaste.bind(this), false);

    this._setupContextMenuListeners(parent);

    parent.appendChild(this._textarea);

    model.on('selectionChanged', this._selectionChanged.bind(this));
    this._commandManager.addCommand(this._deleteChar.bind(this, true), 'backspace', 'Backspace');
    this._commandManager.addCommand(this._deleteChar.bind(this, false), 'delete', 'Delete');
    this._commandManager.addCommand(this._indent.bind(this), 'indent', 'Tab');
    this._commandManager.addCommand(this._dedent.bind(this), 'dedent', 'Shift+Tab');
  }

  _overrideBigSurDoubleSpacePeriod() {
    // On big sur, an annoying default creates a period after two spaces are pressed.
    // This cannot be easily defeated by prevent default, so we have to catch it.
    if (navigator.platform !== 'MacIntel') return;
    let readyToCaptureSpace = 0;
    this._textarea.addEventListener('keydown', event => {
      if (event.key === ' ') {
        readyToCaptureSpace = 1;
      } else {
        readyToCaptureSpace = 0;
      }
    });
    this._textarea.addEventListener('beforeinput', event => {
      if (readyToCaptureSpace === 1 && event.data === ' ') {
        readyToCaptureSpace = 2;
      } else if (readyToCaptureSpace === 2 && event.data === '. '){
        event.preventDefault();
        // two spaces here because one is selected
        document.execCommand('insertText', false, '  ');
        readyToCaptureSpace = 0;
      } else {
        readyToCaptureSpace = 0;
      }
    });
  }

  /**
   * @param {HTMLElement} parent
   */
  _setupContextMenuListeners(parent) {
    parent.addEventListener('mouseup', event => {
      if (event.which !== 3) return;
      // @ts-ignore layerX is a thing shut up
      this._textarea.style.left = event.layerX - 1 + 'px';
      // @ts-ignore layerY is a thing shut up
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
   * @param {{selections: Array<import("./model.js").TextRange>, previousSelections: Array<import("./model.js").TextRange>}} event
   */
  _selectionChanged(event) {
    var mainSelection = event.selections[0];
    this._bufferRange = {
      start: { line: mainSelection.start.line, column: 0 },
      end: {
        line: mainSelection.end.line,
        column: this._model.line(mainSelection.end.line).length
      }
    };

    if (
      this._bufferRange.end.line - this._bufferRange.start.line > 1000 ||
      (this._buffer = this._model.text(this._bufferRange)).length > 1000
    ) {
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
  _onPaste(event) {
    if (event.clipboardData.types.indexOf('text/plain') === -1) return;

    var text = event.clipboardData.getData('text/plain');
    var loc = this._model.replaceRange(text, this._model.selections[0]);
    this._model.setSelections([{ start: loc, end: loc }]);
    this._renderer.scrollLocationIntoView(loc);
    event.preventDefault();
  }

  /**
   * @param {ClipboardEvent} event
   */
  _onCut(event) {
    if (!this._editable) return;
    event.clipboardData.setData('text/plain', this._selectionsText());
    var loc = this._model.replaceRange('', this._model.selections[0]);
    this._model.setSelections([{ start: loc, end: loc }]);
    this._renderer.scrollLocationIntoView(loc);
    event.preventDefault();
  }

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
        end.column = this._model.line(end.line).length;
      }
    }
    const text = value.substring(i, j + 1);
    if (compareRange({ start, end }, this._model.selections[0]) !== 0) {
      const loc = this._model.replaceRange(text, { start, end });
      this._model.setSelections([{ start: loc, end: loc }]);
      this._renderer.scrollLocationIntoView(loc);
    } else {
      if (start.line === end.line && start.column === end.column && this._model.selections.length === 1) {
        const before = this._model.line(start.line).text.substring(0, start.column);
        // TODO actually do this with highlighter
        if (/\t+/.test(before) && (text === '}' || text === ']' || text === ')')) {
          this._replaceRanges(text, this._model.selections.map(selection => {
            return {
              start: { line: selection.start.line, column: selection.start.column - 1 },
              end: { line: selection.start.line, column: selection.start.column }
            };
          }));
          return;
        }
      }
      this._replaceRanges(text, this._model.selections);
    }
  }

  _replaceRanges(text, ranges) {
    /** @type {Array<import("./model.js").TextRange>} */
    let cursors = [];
    for (let i = 0; i < ranges.length; i++) {
      const loc = this._model.replaceRange(text, ranges[i]);
      ranges = ranges.map(selection => rebaseRange(selection, ranges[i], loc));
      cursors = cursors.map(cursor => rebaseRange(cursor, ranges[i], loc));
      cursors.push({ start: loc, end: loc });
    }
    this._model.setSelections(cursors);
    this._renderer.scrollLocationIntoView(cursors[0].start);
  }

  focus() {
    this._textarea.focus();
  }

  /**
   * @param {boolean} backwards
   * @return {boolean}
   */
  _deleteChar(backwards) {
    this._replaceRanges(
      '',
      this._model.selections.map(range => {
        if (!isSelectionCollapsed(range)) return range;

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
              column = this._model.line(line).length;
            }
          }
          return {
            start: {
              line,
              column
            },
            end: range.start
          };
        } else {
          column++;
          if (column > this._model.line(line).length) {
            line++;
            if (line >= this._model.lineCount()) {
              line = this._model.lineCount() - 1;
              column = this._model.line(line).length;
            } else {
              column = 0;
            }
          }
          return {
            start: range.start,
            end: {
              line,
              column
            }
          };
        }
      })
    );
    return true;
  }

  _indent() {
    this._replaceRanges('\t', this._model.selections);
    return true;
  }

  /**
   * @param {string} text
   */
  insertText(text) {
    this._replaceRanges(text, this._model.selections);
  }

  _dedent() {
    const lines = new Set();
    for (const selection of this._model.selections) {
      for (let i = selection.start.line; i < selection.end.line + 1; i++)
        lines.add(i);
      selection.start.column--;
    }
    const movedLines = new Set();
    for (const lineNumber of lines) {
      const line = this._model.line(lineNumber);
      if (line.text.startsWith('\t')) {
        this._model.replaceRange('', {
          start: { line: lineNumber, column: 0 },
          end: { line: lineNumber, column: 1 }
        });
        movedLines.add(lineNumber);
      }
    }
    if (!movedLines.size) return false;
    
    this._model.setSelections(this._model.selections);
    return true;
  }
}

/**
 * @param {import('./model').TextRange} target
 * @param {import('./model').TextRange} from
 * @param {import('./model').Loc} to
 * @return {import('./model').TextRange}
 */
function rebaseRange(target, from, to) {
  const start = rebaseLoc(target.start, from, to);
  const end = rebaseLoc(target.end, from, to);
  return { start, end };
}

/**
 * @param {import('./model').Loc} target
 * @param {import('./model').TextRange} from
 * @param {import('./model').Loc} to
 * @return {import('./model').Loc}
 */
function rebaseLoc(target, from, to) {
  if (compareLocation(target, from.start) <= 0) return target;
  const loc = { line: target.line, column: target.column };
  if (loc.line === from.end.line) loc.column += to.column - from.end.column;
  loc.line += to.line - from.end.line;
  return loc;
}
