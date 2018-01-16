class SelectionManger extends Emitter{
    /**
     * @param {Editor} renderer
     */
    constructor(renderer) {
        super();
        this._renderer = renderer;
        this._anchor = null;
        this._cursor = null;
        renderer.element.addEventListener('mousedown', event => {
            if (event.which !== 1)
                return;
            this._cursor = {
                x: event.offsetX,
                y: event.offsetY
            };
            this._anchor = null;
            this._updateSelection();
        });
        renderer.element.addEventListener('mousemove', event => {
            if (event.which !== 1)
                return;
            this._cursor = {
                x: event.offsetX,
                y: event.offsetY
            };
            this._updateSelection();
        });
    }

    _updateSelection() {
        console.assert(!!this._cursor, 'cursor should be defined');
        var head = this._renderer.locationFromPoint(this._cursor.x, this._cursor.y);
        if (!this._anchor)
            this._anchor = head;
        var start, end;
        if (head.line < this._anchor.line || (head.line === this._anchor.line && head.column < this._anchor.column)) {
            start = head;
            end = this._anchor;
        } else {
            end = head;
            start = this._anchor;
        }
        this._renderer.model.setSelections([{
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
    }

}