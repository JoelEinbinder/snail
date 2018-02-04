class Editor extends Emitter {
  /**
   * @param {string} data
   * @param {Editor.Options=} options
   */
  constructor(data, options = {}) {
    super();
    this.model = new Model(data);
    this.TAB = '    ';

    this._options = options;
    this._debugPainting = false;

    this.element = document.createElement('div');
    this.element.className = 'editor';
    this._highlighter = new Highlighter(this.model, options.language, options.underlay);
    /** @type {WeakMap<Token, string>} */
    this._rasterizedTokens = new WeakMap();
    this._padding = 4;
    this._scrollTop = 0;
    this._scrollLeft = 0;
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
        var y = Math.floor(this.pointFromLocation({ column: 0, line: from }).y - this.scrollTop) - 1;
        var height =
          Math.ceil(this.pointFromLocation({ column: 0, line: to }).y + this._lineHeight - this.scrollTop - y) + 2;
        this._textLayer.invalidate({
          x: 0,
          y,
          width: this._width,
          height
        });
        this.scheduleRefresh();
      }
    });
    this.model.on('selectionChanged', () => {
      this._overlayLayer.invalidate();
      this._overlayLayer.refresh();
    });

    this._scrollingElement = document.createElement('div');
    this._scrollingElement.style.overflow = 'auto';
    this._scrollingElement.style.position = 'absolute';
    this._scrollingElement.style.top = '0';
    this._scrollingElement.style.left = '0';
    this._scrollingElement.style.right = '0';
    this._scrollingElement.style.bottom = '0';
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
    this._lastScrollOffset = {
      top: 0,
      left: 0
    };

    this._longestLineLength = 0;
    for (var i = 0; i < this.model.lineCount(); i++)
      this._longestLineLength = Math.max(
        this._longestLineLength,
        this.model.line(i).text.replace(/\t/g, this.TAB).length
      );
  }

  get scrollTop() {
    // return this._scrollingElement.scrollTop;
    return this._scrollTop;
  }

  get scrollLeft() {
    // return this._scrollingElement.scrollLeft;
    return this._scrollLeft; //this._scrollingElement.scrollLeft;
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
        column: this.model.line(this.model.lineCount() - 1).text.length
      };
    }
    if (y < 0) {
      return {
        line: 0,
        column: 0
      };
    }

    var line = y;
    var { text } = this.model.line(line);
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
      .text.charAt(location.column)
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
    if (location.line >= this.model.lineCount())
      location = editor.model.fullRange().end;
    var { text } = this.model.line(location.line);
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

  _onScroll() {
    this._scrollTop = Math.round(this._scrollingElement.scrollTop * window.devicePixelRatio) / window.devicePixelRatio;
    this._scrollLeft =
      Math.round(this._scrollingElement.scrollLeft * window.devicePixelRatio) / window.devicePixelRatio;
    var rects = [];
    var deltaX = this.scrollLeft - this._lastScrollOffset.left;
    var deltaY = this.scrollTop - this._lastScrollOffset.top;
    if (deltaX > 0) {
      rects.push({ x: this._width - deltaX - 1, y: 0, width: deltaX + 1, height: this._height });
      rects.push({ x: 0, y: 0, width: this._lineNumbersWidth() + 1, height: this._height });
    }
    if (deltaX < 0) rects.push({ x: 0, y: 0, width: this._lineNumbersWidth() + 1 - deltaX + 1, height: this._height });
    if (deltaY > 0) rects.push({ x: 0, y: this._height - deltaY - 1, width: this._width, height: deltaY + 1 });
    if (deltaY < 0) rects.push({ x: 0, y: 0, width: this._width, height: -deltaY + 1 });
    this._textLayer.translate(deltaX, deltaY);
    for (var rect of rects) this._textLayer.invalidate(rect);
    this._overlayLayer.invalidate(); // we dont optimize the overlay layer because its transparent/not worth it.
    this.scheduleRefresh();
    this._lastScrollOffset = {
      top: this.scrollTop,
      left: this.scrollLeft
    };
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
   * @param {Array<Rect>} clipRects
   */
  _drawText(ctx, clipRects) {
    if (!this._lineHeight || !this._charWidth) throw new Error('Must call layout() before draw()');
    if (this._debugPainting) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(0, 0, this._width, this._height);
    }

    var start = performance.now();
    ctx.beginPath();
    for (var clipRect of clipRects) ctx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
    ctx.clip();
    var extendedRect = combineRects(...clipRects);
    ctx.fillStyle = this._backgroundColor;
    ctx.fillRect(extendedRect.x, extendedRect.y, extendedRect.width, extendedRect.height);
    var viewport = this.viewport();
    var farRight = Math.max(...clipRects.map(clipRect => clipRect.x + clipRect.width));
    var lineNumbersWidth = this._lineNumbersWidth();
    var CHUNK_SIZE = 100;
    for (var i = viewport.from; i <= viewport.to; i++) {
      var rect = {
        x: lineNumbersWidth + this._padding - this.scrollLeft,
        y: i * this._lineHeight - this.scrollTop,
        width: Infinity,
        height: this._lineHeight
      };
      if (!clipRects.some(clipRect => intersects(rect, clipRect))) continue;
      rect.width = 0;
      var text = this.model.line(i).text;
      var index = 0;
      outer: for (var token of this._highlighter.tokensForLine(i)) {
        // we dont want too overdraw too much for big tokens
        for (var j = 0; j < token.length; j += CHUNK_SIZE) {
          var chunk = text
            .substring(index + j, index + Math.min(j + CHUNK_SIZE, token.length))
            .replace(/\t/g, this.TAB);
          rect.width = chunk.length * this._charWidth;
          if (clipRects.some(clipRect => intersects(rect, clipRect))) {
            if (token.background) {
              ctx.fillStyle = token.background;
              ctx.fillRect(rect.x, rect.y, 1 + rect.width, 1 + rect.height);
            }
            ctx.fillStyle = token.color || '#222';
            ctx.fillText(chunk, rect.x, rect.y + this._charHeight);
          }
          rect.x += rect.width;
          if (rect.x > farRight) break outer;
        }
        index += token.length;
      }
    }

    if (this._options.lineNumbers) this._drawLineNumbers(ctx);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<Rect>} clipRects
   */
  _drawOverlay(ctx, clipRects) {
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
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
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
    this._dpr = 1;
    this._translation = { x: 0, y: 0 };
  }

  refresh() {
    if (this._translation.x || this._translation.y) {
      this._ctx.drawImage(this.canvas, -this._translation.x, -this._translation.y);
      this._translation = { x: 0, y: 0 };
    }
    if (this._rects.length) {
      this._ctx.save();
      this._ctx.scale(this._dpr, this._dpr);
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
    var dpr = window.devicePixelRatio;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this._width = width;
    this._height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this._dpr = dpr;
    var computedStyle = window.getComputedStyle(this.canvas);

    this._ctx.font = `${computedStyle.fontSize} / ${computedStyle.lineHeight} ${computedStyle.fontFamily}`;
    this.invalidate();
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  translate(x, y) {
    for (var rect of this._rects) {
      rect.x -= x;
      rect.y -= y;
    }
    this._translation.x += Math.round(x * this._dpr);
    this._translation.y += Math.round(y * this._dpr);
  }
}

/**
 * @typedef {Object} Editor.Options
 * @property {boolean=} padBottom
 * @property {boolean=} lineNumbers
 * @property {string=} language
 * @property {function(number,string):Array<Token>} [underlay]
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

/**
 * @param {Array<Rect>} rects
 * @return {Rect}
 */
function combineRects(...rects) {
  var x = Math.min(...rects.map(rect => rect.x));
  var y = Math.min(...rects.map(rect => rect.y));
  var width = Math.max(...rects.map(rect => rect.x + rect.width)) - x;
  var height = Math.max(...rects.map(rect => rect.y + rect.height)) - y;
  return { x, y, width, height };
}
