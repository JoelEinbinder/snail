class Input extends Emitter {
  /**
   * @param {Element} parent
   * @param {Model} model
   */
  constructor(parent, model) {
    super();
    this._model = model;
    this._buffer = '';
    this._bufferRange = null;
    this._editable = true;
    this._textarea = document.createElement('textarea');
    this._textarea.addEventListener('input', this.update.bind(this), false);
    this._textarea.disabled = !this._editable;
    this._textarea.spellcheck = false;
    this._textarea.addEventListener('copy', this._onCopy.bind(this), false);
    this._textarea.addEventListener('cut', this._onCut.bind(this), false);
    parent.appendChild(this._textarea);

    model.on('selectionChanged', this._selectionChanged.bind(this));
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
        column: this._model.line(mainSelection.end.line).length
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
  _onKeyDown(event) {

  }

  /**
   * @return {string}
   */
  _selectionsText() {
    return this._model.selections.map(selection => this._model.text(selection)).join('\n');
  }

  update(event) {
    var value = this._textarea.value;
    if (value === this._buffer) return;
    this._model.replaceRange(value, this._bufferRange);
  }

  focus() {
    this._textarea.focus();
  }
}
