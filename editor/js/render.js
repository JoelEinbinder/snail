class Editor extends Emitter {
  /**
   * @param {Model} model
   * @param {Editor.Options=} options
   */
  constructor(model, options = {}) {
    super();
    this.model = model;
    this.TAB = '    ';

    this._options = options;

    this.element = document.createElement('div');
    this.element.className = 'editor';
    this._highlighter = new Highlighter(this.model);
    this._padding = 4;
    this._refreshScheduled = false;
    this._savedViewport = { x: 0, y: 0, width: 0, height: 0 };

    this._textLayer = new Layer(this._drawText.bind(this));
    this._overlayLayer = new Layer(this._drawOverlay.bind(this));

    this._textLayer.canvas.style.backgroundColor = '#FFF';

    this.element.appendChild(this._textLayer.canvas);
    this.element.appendChild(this._overlayLayer.canvas);

    this._commandManager = new CommandManager(this.element);
    this._input = new Input(this.element, this.model);
    this._selectionManager = new SelectionManger(this, this.model, this._commandManager);

    this._highlighter.on('highlight', ({ from, to }) => {
      var viewport = this.viewport();
      if (viewport.from <= to && from <= viewport.to) {
        this._textLayer.invalidate();
        this.scheduleRefresh();
      }
    });
    this.model.on('selectionChanged', () => {
      this._overlayLayer.invalidate();
      this._overlayLayer.refresh();
    });

    this._scrollingElement = document.createElement('div');
    this._scrollingElement.classList.add('scroller');
    this._fillerElement = document.createElement('div');
    this._scrollingElement.appendChild(this._fillerElement);
    this._scrollingElement.addEventListener('scroll', this._onScroll.bind(this), {
      capture: true,
      passive: false
    });
    this.element.addEventListener('wheel', this._gutterWheel.bind(this), {
      capture: true,
      passive: false
    });
    this._fillerElement.addEventListener('mousedown', event => {
      this.emit('contentMouseDown', event);
    });
    this.element.appendChild(this._scrollingElement);
    this.element.tabIndex = -1;
    this.element.addEventListener('focus', this.focus.bind(this), false);

    this._longestLineLength = 0;
    for (var i = 0; i < this.model.lineCount(); i++)
      this._longestLineLength = Math.max(this._longestLineLength, model.line(i).replace(/\t/g, this.TAB).length);
  }

  get scrollTop() {
    return this._scrollingElement.scrollTop;
  }

  get scrollLeft() {
    return this._scrollingElement.scrollLeft;
  }

  /**
   * @param {number} offsetX
   * @param {number} offsetY
   * @return {Loc}
   */
  locationFromPoint(offsetX, offsetY) {
    var rect = this._scrollingElement.getBoundingClientRect();
    var x = Math.round((offsetX - this._padding + this.scrollLeft - rect.left) / this._charWidth);
    var y = Math.floor((offsetY + this.scrollTop - rect.top) / this._lineHeight);
    if (y >= this.model.lineCount()) {
      return {
        line: this.model.lineCount() - 1,
        column: this.model.line(this.model.lineCount() - 1).length
      };
    }
    if (y < 0) {
      return {
        line: 0,
        column: 0
      };
    }

    var line = y;
    var text = this.model.line(line);
    var column = 0;
    while (column < text.length) {
      x -= text[column] === '\t' ? this.TAB.length : 1;
      if (x < 0) break;
      column++;
    }
    return {
      line,
      column
    };
  }

  /**
   * @param {Loc} location
   */
  scrollLocationIntoView(location) {
    var point = this.pointFromLocation(location);
    var top = point.y - this._padding;
    var left = point.x;
    var bottom = top + this._lineHeight + this._padding * 2;
    var textSize = this.model
      .line(location.line)
      .charAt(location.column)
      .replace(/\t/g, this.TAB).length;
    var right = left + textSize * this._charWidth + this._padding * 2;
    if (top < this.scrollTop) this._scrollingElement.scrollTop = top;
    else if (bottom > this.scrollTop + this._scrollingElement.clientHeight)
      this._scrollingElement.scrollTop = bottom - this._scrollingElement.clientHeight;

    if (left < this.scrollLeft) this._scrollingElement.scrollLeft = left;
    else if (right > this.scrollLeft + this._scrollingElement.clientWidth)
      this._scrollingElement.scrollLeft = right - this._scrollingElement.clientWidth;
  }

  /**
   * @param {Loc} location
   * @return {{x: number, y: number}}
   */
  pointFromLocation(location) {
    var text = this.model.line(location.line);
    return {
      x: text.substring(0, location.column).replace(/\t/g, this.TAB).length * this._charWidth,
      y: location.line * this._lineHeight
    };
  }

  /**
   * @param {WheelEvent} event
   */
  _gutterWheel(event) {
    var node = /** @type {Node} */ (event.target);
    if (node === this._scrollingElement || this._scrollingElement.contains(node)) return;
    var deltaY = event.deltaY;
    var deltaX = event.deltaX;
    if (Math.abs(deltaX) > Math.abs(deltaY)) this._scrollingElement.scrollLeft += deltaX;
    else this._scrollingElement.scrollTop += deltaY;
  }

  /**
   * @param {Event} event
   */
  _onScroll(event) {
    // // TODO partial refresh
    this._overlayLayer.invalidate();
    this._textLayer.invalidate();
    this.scheduleRefresh();
    this.emit('scroll');
  }

  _innerHeight() {
    return this.model.lineCount() * this._lineHeight;
  }

  _innerWidth() {
    return this._longestLineLength * this._charWidth + this._padding * 2;
  }

  refresh() {
    this._overlayLayer.refresh();
    this._textLayer.refresh();
    this._scrollingElement.style.left = this._lineNumbersWidth() + 'px';
    this._fillerElement.style.width = this._innerWidth() + 'px';
    var height = this._innerHeight();
    if (this._options.padBottom) {
      // there is always a y-scroll, so set height first to a big value
      this._fillerElement.style.height = height + this._scrollingElement.clientHeight * 2 + 'px';
      // Now that there is a y-scrll, we can correctly set the y value
      height += this._scrollingElement.clientHeight - this._lineHeight;
    }
    this._fillerElement.style.height = height + 'px';
  }

  viewport() {
    return {
      from: this._lineForOffset(this.scrollTop),
      to: Math.min(this.model.lineCount() - 1, this._lineForOffset(this.scrollTop + this._height))
    };
  }

  scheduleRefresh() {
    if (this._refreshScheduled) return;
    this._refreshScheduled = true;
    requestAnimationFrame(() => {
      this._refreshScheduled = false;
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
   * @param {Array<Rect>} rects
   */
  _drawText(ctx, rects) {
    if (!this._lineHeight || !this._charWidth) throw new Error('Must call layout() before draw()');
    var start = performance.now();
    ctx.fillStyle = this._backgroundColor;
    ctx.fillRect(0, 0, this._width, this._height);
    var screenRect = { x: 0, y: 0, width: this._width, height: this._height };
    var viewport = this.viewport();
    var lineNumbersWidth = this._lineNumbersWidth();
    var CHUNK_SIZE = 100;
    for (var i = viewport.from; i <= viewport.to; i++) {
      var rect = {
        x: lineNumbersWidth + this._padding - this.scrollLeft,
        y: i * this._lineHeight - this.scrollTop,
        width: 0,
        height: this._lineHeight
      };
      for (var token of this._highlighter.tokensForLine(i)) {
        // we dont want too overdraw too much for big tokens
        for (var j = 0; j < token.text.length; j += CHUNK_SIZE) {
          var chunk = token.text.substring(j, j + CHUNK_SIZE).replace(/\t/g, this.TAB);
          rect.width = chunk.length * this._charWidth;
          if (intersects(rect, screenRect)) {
            if (token.background) {
              ctx.fillStyle = token.background;
              ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            }
            ctx.fillStyle = token.color || '#222';
            ctx.fillText(chunk, rect.x, rect.y + this._charHeight);
          }
          rect.x += rect.width;
        }
      }
    }

    if (this._options.lineNumbers) this._drawLineNumbers(ctx);

    document.title = String(Math.round(1000 / (performance.now() - start)));
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<Rect>} rects
   */
  _drawOverlay(ctx, rects) {
    ctx.clearRect(0, 0, this._width, this._height);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    var lineNumbersWidth = this._lineNumbersWidth();
    for (var selection of this.model.selections) {
      if (!isSelectionCollapsed(selection)) continue;
      var point = this.pointFromLocation(selection.start);
      var rect = {
        x: lineNumbersWidth + this._padding - this.scrollLeft + point.x,
        y: point.y - this.scrollTop + (this._lineHeight - this._charHeight) / 4 - 1,
        width: 1.5,
        height: this._charHeight + 2
      };
      if (rects.find(otherRect => intersects(otherRect, rect))) ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  _lineNumbersWidth() {
    if (!this._options.lineNumbers) return 0;
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
    var { from, to } = this.viewport();
    for (var i = from; i <= to; i++) {
      ctx.fillText(
        String(i + 1),
        width - ctx.measureText(String(i + 1)).width - this._padding,
        i * this._lineHeight + this._charHeight - this.scrollTop
      );
    }
  }

  layout() {
    var rect = this.element.getBoundingClientRect();
    this._width = rect.width;
    this._height = rect.height;
    this._backgroundColor = window.getComputedStyle(this._textLayer.canvas).backgroundColor;
    this._charHeight = parseInt(window.getComputedStyle(this._textLayer.canvas).fontSize);
    this._lineHeight = Math.max(parseInt(window.getComputedStyle(this._textLayer.canvas).lineHeight), this._charHeight);
    this._overlayLayer.layout(rect.width, rect.height);
    this._textLayer.layout(rect.width, rect.height);
    this._charWidth = this._textLayer.canvas.getContext('2d').measureText('x').width;
    this.refresh();
  }

  focus() {
    this._input.focus();
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
    if (this._rects.length) {
      this._ctx.save();
      this._draw(this._ctx, this._rects);
      this._ctx.restore();
    }
    this._rects = [];
  }

  /**
   * @param {Rect=} rect
   */
  invalidate(rect) {
    if (!rect) {
      this._rects = [{ x: 0, y: 0, width: this._width, height: this._height }];
      return;
    }

    var newRects = [rect];
    for (var otherRect of this._rects) {
      if (contains(rect, otherRect)) return;
      if (!contains(otherRect, rect)) newRects.push(otherRect);
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
    this._ctx.font = window.getComputedStyle(this.canvas).font;
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
  return (
    inside.x >= outside.x &&
    inside.x + inside.width <= outside.x + outside.width &&
    inside.y >= outside.y &&
    inside.y + inside.height <= outside.y + outside.height
  );
}
