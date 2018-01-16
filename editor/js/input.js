class Input extends Emitter {
    /**
     * @param {Element} parent
     * @param {Model} model
     */
    constructor(parent, model) {
        super();
        this._model = model;
        this._buffer = "";
        this._bufferRange = null;
        this._editable = true;
        this._textarea = document.createElement('textarea');
        this._textarea.addEventListener('input', this.update.bind(this), false);
        this._textarea.disabled = !this._editable;
        this._textarea.spellcheck = false;
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
            end: { line: mainSelection.end.line, column: this._model.line(mainSelection.end.line).length }
        }
        this._buffer = this._model.text(this._bufferRange);
        this._textarea.value = this._buffer;
        this._textarea.setSelectionRange(
            mainSelection.start.column - this._bufferRange.start.column,
            this._buffer.length - this._bufferRange.end.column + mainSelection.end.column)
    }

    update(event) {
        var value = this._textarea.value;
        if (value === this._buffer)
            return;
        this._model.replaceRange(value, this._bufferRange)
    }

    focus() {
        this._textarea.focus();
    }
}