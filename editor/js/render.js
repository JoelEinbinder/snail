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
        this._scrollTop = 0;
        this._scrollLeft = 0;
        this._padding = 4;
        this._refreshScheduled = false;
        this._savedViewport = {x: 0, y: 0, width: 0, height: 0};

        this._overlayLayer = new Layer(this._drawOverlay.bind(this));
        this.element.appendChild(this._overlayLayer.canvas);

        /** @type {Array<Sel>} */
        this._selections = [{start: {line: 0, column: 0}, end: {line: 0, column: 0}}];

        this._highlighter.on('highlight', ({from, to}) => {
            var viewport = this.viewport();
            if (viewport.from <= to && from <= viewport.to)
                this.scheduleRefresh();
        });
        this.element.addEventListener('mousedown', event => {
            if (event.which === 1)
                this._setSelectionFromPoint(event.offsetX, event.offsetY);
        });
        this.element.addEventListener('mousemove', event => {
            if (event.which === 1)
                this._setSelectionFromPoint(event.offsetX, event.offsetY);
        });
    }

    _setSelectionFromPoint(offsetX, offsetY) {
        var x = Math.round((offsetX - this._lineNumbersWidth() - this._padding + this._scrollLeft) / this._charWidth)
        var y = Math.floor((offsetY + this._scrollTop) / this._lineHeight);
        var line = Math.max(Math.min(y, this.model.lineCount() - 1), 0);
        var column = Math.min(x, this.model.line(line).length);
        this._selections = [{start: {line, column}, end: {line, column}}];
        this._overlayLayer.invalidate();
        this._overlayLayer.refresh();
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
        this._scrollLeft = Math.max(
            Math.min(
                this._scrollLeft + event.deltaX,
                this._innerWidth() - this._width),
            0);
        event.preventDefault();
        // TODO partial refresh
        this._overlayLayer.invalidate();
        this._overlayLayer.refresh();
        this.scheduleRefresh();
    }

    _innerWidth() {
        return this._lineNumbersWidth() + this.model.longestLineLength() * this._charWidth + this._padding * 2;
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
        var screenRect = {x: 0, y: 0, width: this._width, height: this._height};
        var viewport = this.viewport();
        var lineNumbersWidth = this._lineNumbersWidth();
        for (var i = viewport.from; i <= viewport.to; i++) {
            var rect = {x: lineNumbersWidth + this._padding - this._scrollLeft, y: i*this._lineHeight - this._scrollTop, width: 0, height: this._lineHeight};
            for (var token of this._highlighter.tokensForLine(i)) {
                rect.width = token.text.length * this._charWidth; // TODO tabs. Maybe the highlighter should handle that?
                if (intersects(rect, screenRect)) {
                    ctx.fillStyle = token.color;
                    ctx.fillText(token.text, rect.x, rect.y + this._charHeight);
                }
                rect.x += rect.width;
            }
        }

        if (this._options.lineNumbers)
            this._drawLineNumbers(ctx);

        // this._overlayLayer.refresh();
        // ctx.drawImage(this._overlayLayer.canvas, 0, 0, this._width, this._height);

        document.title = String(Math.round(1000 / (performance.now() - start)));
        console.log("frame", performance.now() - start);
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array<Rect>} rects
     */
    _drawOverlay(ctx, rects) {
        ctx.clearRect(0, 0, this._width, this._height);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        var lineNumbersWidth = this._lineNumbersWidth();
        for (var selection of this._selections) {
            var rect = {
                x: lineNumbersWidth + this._padding - this._scrollLeft + selection.start.column * this._charWidth,
                y: selection.start.line * this._lineHeight - this._scrollTop + (this._lineHeight - this._charHeight)/4 - 1,
                width: 1.5,
                height: this._charHeight + 2
            };
            if (rects.find(otherRect => intersects(otherRect, rect)))
                ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        }
    }

    _lineNumbersWidth() {
        if (!this._options.lineNumbers)
            return 0;
        return Math.max(this._charWidth * Math.ceil(Math.log10(this.model.lineCount())) + this._padding * 2, 22);
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
            ctx.fillText(String(i+1), width - ctx.measureText(String(i+1)).width - this._padding, i*this._lineHeight + this._charHeight - this._scrollTop);
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
        this._canvas.style.position = 'absolute';
        this._canvas.style.top = '0';
        this._canvas.style.left = '0';
        this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this._ctx.font = window.getComputedStyle(this._canvas).font;
        this._backgroundColor = window.getComputedStyle(this._canvas).backgroundColor;
        this._charHeight = parseInt(window.getComputedStyle(this._canvas).fontSize);
        this._lineHeight = Math.max(parseInt(window.getComputedStyle(this._canvas).lineHeight), this._charHeight);
        this._charWidth = this._ctx.measureText('x').width;
        this._overlayLayer.layout(rect.width, rect.height);
        this.refresh();
    }
}

class Layer {
    /**
     * @param {function(CanvasRenderingContext2D, Array<Rect>)} draw
     */
    constructor(draw) {
        this.canvas = document.createElement('canvas');
        this._ctx = this.canvas.getContext('2d');
        this._draw = draw;
        /** @type {Array<Rect>} */
        this._rects = [];
        this._width = 0;
        this._height = 0;
    }

    refresh() {
        if (this._rects.length)
            this._draw(this._ctx, this._rects);
        this._rects = [];
    }

    /**
     * @param {Rect=} rect
     */
    invalidate(rect) {
        if (!rect) {
            this._rects = [{x: 0, y: 0, width: this._width, height: this._height}];
            return;
        }

        var newRects = [rect];
        for (var otherRect of this._rects) {
            if (contains(rect, otherRect))
                return;
            if (!contains(otherRect, rect))
                newRects.push(otherRect);
        }
        this._rects = newRects;
    }

    layout(width, height) {
        this.canvas.width = width * window.devicePixelRatio;
        this.canvas.height = height * window.devicePixelRatio;
        this._width = width;
        this._height = height;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.invalidate();
    }
}

/**
 * @typedef {Object} Editor.Options
 * @property {boolean=} padBottom
 * @property {boolean=} lineNumbers
 */

/**
 * @typedef {Object} Rect
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @param {Rect} a
 * @param {Rect} b
 * @return {boolean}
 */
function intersects(a, b) {
    return a.x + a.width > b.x && b.x + b.width > a.x && a.y + a.height > b.y && b.y + b.height > a.y;
}

/**
 * @param {Rect} inside
 * @param {Rect} outside
 * @return {boolean}
 */
function contains(inside, outside) {
    return inside.x >= outside.x && inside.x + inside.width <= outside.x + outside.width && inside.y >= outside.y && inside.y + inside.height <= outside.y + outside.height;
}

/**
 * @typedef {Object} Loc
 * @property {number} column
 * @property {number} line
 */

/**
 * @typedef {Object} Sel
 * @property {Loc} start
 * @property {Loc} end
 */
