class Editor {
    /**
     * @param {Model} model
     * @param {Editor.Options=} options
     */
    constructor(model, options = {}) {
        this.model = model;
        this._options = options;

        this.element = document.createElement('div');
        this.element.className = 'editor';
        this._canvas = document.createElement('canvas');
        this._canvas.style.backgroundColor = '#FFF';
        this._ctx = this._canvas.getContext('2d');
        this.element.appendChild(this._canvas);
        this._highlighter = new Highlighter(this.model);
        this.element.addEventListener('wheel', this._onWheel.bind(this), true);
        this._scrollTop = 4000;
        this._scrolLeft = 0;
        this._refreshScheduled = false;
        this._highlighter.on('highlight', ({from, to}) => {
            var viewport = this.viewport();
            if (viewport.from <= to && from <= viewport.to)
                this.scheduleRefresh();
        });
    }

    /**
     * @param {WheelEvent} event
     */
    _onWheel(event) {
        this._scrollTop = Math.max(
            Math.min(
                this._scrollTop + event.deltaY,
                this.model.lineCount() * this._lineHeight - (this._options.padBottom ? this._lineHeight : this._height)),
            0);
        this._scrolLeft = Math.max(
            Math.min(
                this._scrolLeft + event.deltaX,
                this.model.longestLineLength() * this._charWidth - this._width),
            0);
        event.preventDefault();
        // TODO partial refresh
        this.scheduleRefresh();
    }

    refresh() {
        this._ctx.save();
        this.draw(this._ctx);
        this._ctx.restore();
    }

    viewport() {
        return {
            from: this._lineForOffset(this._scrollTop),
            to: Math.min(this.model.lineCount() -1, this._lineForOffset(this._scrollTop + this._height))
        };
    }

    scheduleRefresh() {
        if (this._refreshScheduled)
            return;
        this._refreshScheduled = true;
        requestAnimationFrame(() => {
            this._refreshScheduled =false;
            this.refresh();
        });
    }

    /**
     * @param {number} y
     */
    _lineForOffset(y) {
        return Math.floor(y / this._lineHeight);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        if (!this._lineHeight || !this._charWidth)
            throw new Error('Must call layout() before draw()');
        var start = performance.now();
        ctx.fillStyle = this._backgroundColor;
        ctx.fillRect(0,0,this._width, this._height);
        var viewport = this.viewport();
        var lineNumbersWidth = this._lineNumbersWidth();
        for (var i = viewport.from; i <= viewport.to; i++) {
            var x = 0;
            for (var token of this._highlighter.tokensForLine(i)) {
                var width = token.text.length * this._charWidth; // TODO tabs. Maybe the highlighter should handle that?
                if (x + width > this._scrolLeft && x - this._scrolLeft < this._width) {
                    ctx.fillStyle = token.color;
                    ctx.fillText(token.text, x + lineNumbersWidth + 4 - this._scrolLeft, i*this._lineHeight + this._charHeight - this._scrollTop );
                }
                x += width;
            }
        }

        if (this._options.lineNumbers)
            this._drawLineNumbers(ctx);

        document.title = String(Math.round(1000 / (performance.now() - start)));
        console.log("frame", performance.now() - start);
    }

    _lineNumbersWidth() {
        return Math.max(this._charWidth * Math.ceil(Math.log10(this.model.lineCount())) + 4, 22);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     */
    _drawLineNumbers(ctx) {
        var width = this._lineNumbersWidth();
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(0, 0, width, this._height);
        ctx.fillStyle = '#bbbbbb';
        ctx.fillRect(width - 1, 0, 1, this._height);

        ctx.fillStyle = 'rgb(128, 128, 128)';
        var {from, to} = this.viewport();
        for (var i = from; i <= to; i++) {
            ctx.fillText(String(i+1), width - ctx.measureText(String(i+1)).width - 4, i*this._lineHeight + this._charHeight - this._scrollTop);
        }
    }

    layout() {
        var rect = this.element.getBoundingClientRect();
        this._canvas.width = rect.width * window.devicePixelRatio;
        this._canvas.height = rect.height * window.devicePixelRatio;
        this._width = rect.width;
        this._height = rect.height;
        this._canvas.style.width = rect.width + 'px';
        this._canvas.style.height = rect.height + 'px';
        this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this._ctx.font = window.getComputedStyle(this._canvas).font;
        this._backgroundColor = window.getComputedStyle(this._canvas).backgroundColor;
        this._charHeight = parseInt(window.getComputedStyle(this._canvas).fontSize);
        this._lineHeight = Math.max(parseInt(window.getComputedStyle(this._canvas).lineHeight), this._charHeight);
        this._charWidth = this._ctx.measureText('x').width;
        this.refresh();
    }
}

/**
 * @typedef {Object} Editor.Options
 * @property {boolean=} padBottom
 * @property {boolean=} lineNumbers
 */
