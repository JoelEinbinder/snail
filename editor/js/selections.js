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
                x: event.layerX,
                y: event.layerY
            };
            this._anchor = null;
            this._updateSelection();
            this._trackDrag();
        });
    }

    _trackDrag() {
        // We have to listen on the window so that you can select outside the bounds
        var window = this._renderer.element.ownerDocument.defaultView;
        /** @type {function(MouseEvent)} */
        var mousemove = event => {
            this._cursor = {
                x: event.layerX,
                y: event.layerY
            };
            this._updateSelection();
        };
        /** @type {function(MouseEvent)} */
        var mouseup = event => {
            window.removeEventListener('mousemove', mousemove, true);
            window.removeEventListener('mouseup', mouseup, true)
        };
        window.addEventListener('mousemove', mousemove, true)
        window.addEventListener('mouseup', mouseup, true)
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