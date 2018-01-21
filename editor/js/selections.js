class SelectionManger extends Emitter{
    /**
     * @param {Editor} renderer
     */
    constructor(renderer) {
        super();
        this._renderer = renderer;
        this._anchor = null;
        this._cursor = null;
        this._renderer.on('contentMouseDown', this._contentMouseDown.bind(this));
    }

    /**
     * @param {MouseEvent} event
     */
    _contentMouseDown(event) {
        if (event.which !== 1)
            return;
        if (event.detail >= 4) {
            this._renderer.model.setSelections([this._renderer.model.fullRange()])
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
            window.removeEventListener('mouseup', mouseup, true)
            this._renderer.off('scroll', scroll);
        };
        var scroll = () => {
            this._update();
        };
        window.addEventListener('mousemove', mousemove, true)
        window.addEventListener('mouseup', mouseup, true)
        this._renderer.on('scroll', scroll);
    }

    _update() {
        console.assert(!!this._cursor, 'cursor should be defined');
        console.assert(this._increment > 0 && this._increment <= 3, 'unknown increment');
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
        if (this._increment === 1) {
            this._renderer.model.setSelections([{
                start: {
                    line: start.line,
                    column: start.column
                },
                end: {
                    line: end.line,
                    column: end.column
                }
            }]);
        }
        else if (this._increment === 2) {
            var startColumn = start.column;
            var text = this._renderer.model.line(start.line);
            if (startColumn > 0 && startColumn < text.length) {
                var type = this._charType(text[startColumn])
                for (var i = startColumn - 1; i >= 0 && type === this._charType(text[i]); i--)
                    startColumn = i;
            }

            var endColumn = end.column;
            text = this._renderer.model.line(end.line);
            if (endColumn < text.length) {
                var type = this._charType(text[endColumn])
                for (var i = endColumn + 1; i <= text.length && type === this._charType(text[i - 1]); i++)
                    endColumn = i;
            }


            this._renderer.model.setSelections([{
                start: {
                    line: start.line,
                    column: startColumn
                },
                end: {
                    line: end.line,
                    column: endColumn
                }
            }]);
        }
        else if (this._increment === 3) {
            this._renderer.model.setSelections([{
                start: {
                    line: start.line,
                    column: 0
                },
                end: {
                    line: end.line,
                    column: this._renderer.model.line(end.line).length
                }
            }]);
        }
        this._renderer.scrollLocationIntoView(head);
    }

    /**
     * @param {string} character
     * @return {number}
     */
    _charType(character) {
        if (character.match(/\s/))
            return 0;
        if (character.match(/[0-9a-zA-Z]/))
            return 1;
        if (character)
            return 2;
        return -1;
    }

}