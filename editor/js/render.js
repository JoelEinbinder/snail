class Editor {
    /**
     * @param {Model} model
     */
    constructor(model) {
        this.element = document.createElement('div');
        this.element.className = 'editor';
        this._canvas = document.createElement('canvas');
        this._ctx = this._canvas.getContext('2d');
        this.element.appendChild(this._canvas);
        this.model = model;
        this._highlighter = new Highlighter(this.model);
        this.element.addEventListener('wheel', this._onWheel.bind(this), true);
        this._scrollTop = 0;
        this._scrolLeft = 0;
        this._refreshScheduled = false;
    }

    /**
     * @param {WheelEvent} event
     */
    _onWheel(event) {
        this._scrollTop = Math.max(Math.min(this._scrollTop + event.deltaY, this.model.lineCount() * this._lineHeight), 0);
        event.preventDefault();
        // this.scheduleRefresh();
        this.refresh();
    }

    get width() {
        return this._canvas.width / window.devicePixelRatio;
    }

    get height() {
        return this._canvas.height / window.devicePixelRatio;
    }

    refresh() {
        this._ctx.save();
        this.draw(this._ctx);
        this._ctx.restore();
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
        ctx.clearRect(0,0,this.width, this.height);
        for (var i = this._lineForOffset(this._scrollTop); i < this.model.lineCount() && i * this._lineHeight - this._scrollTop < this.height; i++) {
            var x = 0;
            for (var token of this._highlighter.tokensForLine(i)) {
                var width = ctx.measureText(token.text).width
                if (x + width > this._scrolLeft && x < this.width) {
                    ctx.fillStyle = token.color;
                    ctx.fillText(token.text, x, i*this._lineHeight + this._charHeight - this._scrollTop );
                }
                x += width;
            }
        }

        console.log("frame", performance.now() - start);
    }

    layout() {
        var rect = this.element.getBoundingClientRect();
        this._canvas.width = rect.width * window.devicePixelRatio;
        this._canvas.height = rect.height * window.devicePixelRatio;
        this._canvas.style.width = rect.width + 'px';
        this._canvas.style.height = rect.height + 'px';
        this._ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this._ctx.font = window.getComputedStyle(this._canvas).font;
        this._charHeight = parseInt(window.getComputedStyle(this._canvas).fontSize);
        this._lineHeight = Math.max(parseInt(window.getComputedStyle(this._canvas).lineHeight), this._charHeight);
        this._charWidth = this._ctx.measureText('x').width;
        this.refresh();
    }
}

async function go() {
    var content = await (await fetch('text/medium.js')).text();

    var editor = new Editor(new Model(content.repeat(100)));
    document.body.appendChild(editor.element);
    editor.layout();
    window.addEventListener('resize', event => editor.layout(), false);
}
go();