import { Emitter } from "./emitter";
import { isSelectionCollapsed } from "./model.js";

export class Renderer extends Emitter {
  /**
   * @param {import('./model').Model} model
   * @param {HTMLElement} element
   * @param {import('./highlighter').Highlighter} highlighter
   * @param {import('./editor').EditorOptions=} options
   */
  constructor(model, element, highlighter, options = {}) {
    super();
    this.TAB = '    ';
    this._model = model;

    this._options = options;
    this._debugPainting = false;

    this._highlighter = highlighter;
    this.element = element;

    /** @type {WeakMap<import("./highlighter").Token, string>} */
    this._rasterizedTokens = new WeakMap();
    this._padding = typeof this._options.padding === 'number' ? this._options.padding : 4;
    this._scrollTop = 0;
    this._scrollLeft = 0;
    this._refreshScheduled = false;

    this._hasFocus = false;
    this.element.addEventListener('focusin', () => {
      this._computeHasFocus();
    });
    this.element.addEventListener('focusout', () => {
      this._computeHasFocus();
    });

    this._textLayer = new Layer(this._drawText.bind(this));
    this._overlayLayer = new Layer(this._drawOverlay.bind(this));

    if (this._options.backgroundColor)
      this._textLayer.canvas.style.backgroundColor = this._options.backgroundColor;

    /** @type {WeakMap<import('./model').Line, Array<{column: number, offset: number}>>} */
    this._lineMetrics = new WeakMap();
    this._charWidths = {};

    this.element.appendChild(this._textLayer.canvas);
    this.element.appendChild(this._overlayLayer.canvas);

    if (this._options.inline) this._options.padBottom = false;
    var lineCount = 1;
    this._model.on('change', () => {
      if (this._model.lineCount() === lineCount) return;
      if (this._options.inline) this.layout();
      else {
        const from = Math.min(lineCount, this._model.lineCount());
        const to = Math.max(lineCount, this._model.lineCount());
        const y = Math.floor(from * this._lineHeight - this.scrollTop) - 1;
        const height = Math.ceil((to + 1) * this._lineHeight - this.scrollTop - y) + 2;
        this._textLayer.invalidate({ x: 0, y, width: this._width, height });
        this.scheduleRefresh();
      }
      lineCount = this._model.lineCount();
    });

    var lastDpr = window.devicePixelRatio;
    window.addEventListener(
      'resize',
      event => {
        if (lastDpr === window.devicePixelRatio) return;
        lastDpr = window.devicePixelRatio;
        this.layout();
      },
      false
    );

    this._highlighter.on('highlight', ({ from, to }) => {
      var viewport = this.viewport();
      if (viewport.from <= to && from <= viewport.to) {
        var y = Math.floor(from * this._lineHeight - this.scrollTop) - 1;
        var height = Math.ceil((to + 1) * this._lineHeight - this.scrollTop - y) + 2;
        this._textLayer.invalidate({
          x: 0,
          y,
          width: this._width,
          height
        });
        this.scheduleRefresh();
      }
    });
    this._model.on('selectionChanged', () => {
      this._highlightWordOccurrences = false;
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
    this._lastScrollOffset = {
      top: 0,
      left: 0
    };
    this.colors = this._options.colors || {
      foreground: '#222',
      selectionBackground: 'rgba(0,128,255,0.1)',
      cursorColor: 'rgba(0,0,0,0.8)',
    };
  }

  highlightWordOccurrences() {
    if (!this._options.highlightWordOccurrences)
      return;
    this._highlightWordOccurrences = true;
    this._overlayLayer.invalidate();
    this._overlayLayer.refresh();
  }

  /**
   * @param {string} text
   */
  setText(text) {
    this._model.replaceRange(text, this._model.fullRange());
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
   * @return {import('./model.js').Loc}
   */
  locationFromPoint(offsetX, offsetY) {
    var rect = this._scrollingElement.getBoundingClientRect();
    var y = Math.floor((offsetY + this.scrollTop - rect.top) / this._lineHeight);
    if (y >= this._model.lineCount()) {
      return {
        line: this._model.lineCount() - 1,
        column: this._model.line(this._model.lineCount() - 1).length
      };
    }
    if (y < 0) {
      return {
        line: 0,
        column: 0
      };
    }

    var lineNumber = y;
    var line = this._model.line(lineNumber);
    var x = offsetX - this._padding + this._scrollLeft - rect.left;
    var alpha = 0;
    var beta = line.length;
    var column;
    while (Math.abs(alpha - beta) > 1) {
      column = Math.floor((alpha + beta) / 2);
      var value = this._textMeasuring.xOffsetFromLocation(line, column);
      if (x > value) alpha = Math.min(column, line.length);
      else beta = Math.max(column, 0);
    }
    column =
      Math.abs(this._textMeasuring.xOffsetFromLocation(line, alpha) - x) >
      Math.abs(this._textMeasuring.xOffsetFromLocation(line, beta) - x)
        ? beta
        : alpha;
    return {
      line: lineNumber,
      column
    };
  }

  /**
   * @param {import('./model.js').Loc} location
   */
  scrollLocationIntoView(location) {
    this._updateMetrics();
    var point = this.pointFromLocation(location);
    var top = point.y - this._padding + this._scrollTop;
    var left = point.x - this._leftOffset();
    var bottom = top + this._lineHeight + this._padding * 2;
    var textSize = this._model
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
   * @param {import('./model.js').Loc} location
   * @return {{x: number, y: number}}
   */
  pointFromLocation(location) {
    if (location.line >= this._model.lineCount()) location = this._model.fullRange().end;
    var line = this._model.line(location.line);
    return {
      x: this._textMeasuring.xOffsetFromLocation(line, location.column) + this._leftOffset(),
      y: location.line * this._lineHeight - this._scrollTop
    };
  }

  _leftOffset() {
    return this._lineNumbersWidth() + this._padding - this.scrollLeft;
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
    this._overlayLayer.translate(deltaX, deltaY);
    for (var rect of rects) {
      this._textLayer.invalidate(rect);
      this._overlayLayer.invalidate(rect);
    }
    this.scheduleRefresh();
    this._lastScrollOffset = {
      top: this.scrollTop,
      left: this.scrollLeft
    };
    this.emit('scroll');
  }

  _innerHeight() {
    return this._model.lineCount() * this._lineHeight;
  }

  _innerWidth() {
    return this._textMeasuring.longestLineLength() + this._padding * 2;
  }

  refresh() {
    this._overlayLayer.refresh();
    this._textLayer.refresh();
    this._updateMetrics();
  }

  _updateMetrics() {
    this._scrollingElement.style.left = this._lineNumbersWidth() + 'px';
    this._fillerElement.style.minWidth = this._innerWidth() + 'px';
    var height = this._innerHeight();
    if (this._options.padBottom) {
      // there is always a y-scroll, so set height first to a big value
      this._fillerElement.style.height = height + this._scrollingElement.clientHeight * 2 + 'px';
      // Now that there is a y-scrll, we can correctly set the y value
      height += this._scrollingElement.clientHeight - this._lineHeight;
    }
    this._fillerElement.style.minHeight = height + 'px';
    this._fillerElement.style.height = this._scrollingElement.offsetHeight + 'px';
  }

  viewport() {
    return {
      from: this._lineForOffset(this.scrollTop),
      to: Math.min(this._model.lineCount() - 1, this._lineForOffset(this.scrollTop + this._height))
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

    ctx.beginPath();
    for (var clipRect of clipRects) ctx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
    ctx.clip();
    var extendedRect = combineRects(...clipRects);
    if (this._options.backgroundColor) {
      ctx.fillStyle = this._options.backgroundColor;
      ctx.fillRect(extendedRect.x, extendedRect.y, extendedRect.width, extendedRect.height);
    } else {
      ctx.clearRect(extendedRect.x, extendedRect.y, extendedRect.width, extendedRect.height);
    }
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
      var text = this._model.line(i).text;
      var index = 0;
      var lastX = this._textMeasuring.xOffsetFromLocation(this._model.line(i), 0);
      var count = 0;
      outer: for (var token of this._highlighter.tokensForLine(i)) {
        // we dont want too overdraw too much for big tokens
        for (var j = 0; j < token.length; j += CHUNK_SIZE) {
          var start = index + j;
          var end = index + Math.min(j + CHUNK_SIZE, token.length);
          var chunk = text.substring(start, end).replace(/\t/g, this.TAB);
          rect.width = this._textMeasuring.xOffsetFromLocation(this._model.line(i), end) - lastX;
          if (clipRects.some(clipRect => intersects(rect, clipRect))) {
            if (token.background) {
              ctx.fillStyle = token.background;
              ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            }
            ctx.fillStyle = token.color || this.colors.foreground;
            count += chunk.length;
            ctx.fillText(chunk, rect.x, rect.y + this._charHeight);
          }
          rect.x += rect.width;
          lastX += rect.width;
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
    var selection = this._model.selections[0];
    var word;
    if (isSelectionCollapsed(selection)) {
      if (this._highlightWordOccurrences) {
        var text = this._model.line(selection.start.line).text;
        var pos = selection.start.column;
        var left = text.slice(0, pos).search(/[A-Za-z0-9_]+$/);
        if (left < 0) left = pos;

        var right = text.slice(pos).search(/[^A-Za-z0-9_]/) + pos;
        if (right < pos) right = text.length;
        word = text.substring(left, right).toLowerCase();
      } else {
        word = '';
      }
    } else {
      word = this._model.text(selection).toLowerCase();
    }
    if (word.match(/^\s+$/)) word = '';
    var lineNumbersWidth = this._lineNumbersWidth();
    ctx.fillStyle = this.colors.selectionBackground;
    if (word) {
      var viewport = this.viewport();
      for (var i = viewport.from; i <= viewport.to; i++) {
        var text = this._model.line(i).text.toLowerCase();
        var index = -1;
        while ((index = text.indexOf(word, index + 1)) !== -1) {
          if (
            i === selection.start.line &&
            index === selection.start.column &&
            index + word.length === selection.end.column
          )
            continue;
          var start = this.pointFromLocation({ line: i, column: index });
          var end = this.pointFromLocation({ line: i, column: index + word.length });
          ctx.fillRect(
            start.x,
            start.y,
            end.x - start.x,
            this._lineHeight
          );
        }
      }
    }

    ctx.fillStyle = this.colors.cursorColor;
    if (!this._options.readOnly && this._hasFocus) {
      for (var selection of this._model.selections) {
        if (!isSelectionCollapsed(selection)) continue;
        var point = this.pointFromLocation(selection.start);
        var rect = {
          x: point.x,
          y: point.y + (this._lineHeight - this._charHeight) / 4 - 1,
          width: 1.5,
          height: this._charHeight + 2
        };
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
    }
  }

  _computeHasFocus() {
    const newFocus = hasFocus(this.element) && this.element.ownerDocument.hasFocus();
    if (newFocus === this._hasFocus)
      return;
    this._hasFocus = newFocus;
    this._overlayLayer.invalidate();
    this._overlayLayer.refresh();
  }

  _lineNumbersWidth() {
    if (!this._options.lineNumbers) return 0;
    return Math.max(this._charWidth * Math.ceil(Math.log10(this._model.lineCount())) + this._padding * 2, 22);
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
    this._charHeight = parseInt(window.getComputedStyle(this._textLayer.canvas).fontSize);
    this._lineHeight = Math.max(parseInt(window.getComputedStyle(this._textLayer.canvas).lineHeight), this._charHeight);
    if (this._options.inline) {
      this.element.style.height = this._innerHeight() + 'px';
    }
    var rect = this.element.getBoundingClientRect();
    this._width = rect.width;
    this._height = rect.height;
    this._overlayLayer.layout(rect.width, rect.height);
    this._textLayer.layout(rect.width, rect.height);
    var last = this._charWidth;
    var ctx = this._textLayer.canvas.getContext('2d');
    this._charWidth = ctx.measureText('x').width;
    if (this._charWidth !== last)
      this._textMeasuring = new TextMeasuring(
        char => this._textLayer._ctx.measureText(char === '\t' ? this.TAB : char).width
      );
    this.refresh();
  }

  get lineHeight() {
    return this._lineHeight;
  }
}

class Layer {
  /**
   * @param {function(CanvasRenderingContext2D, Array<Rect>):void} draw
   */
  constructor(draw) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.setProperty('font-kerning', 'none');
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
      this._ctx.globalCompositeOperation = 'copy';
      this._ctx.drawImage(this.canvas, -this._translation.x, -this._translation.y);
      this._translation = { x: 0, y: 0 };
      this._ctx.globalCompositeOperation = 'source-over';
    }
    if (this._rects.length) {
      this._ctx.save();
      this._ctx.scale(this._dpr, this._dpr);
      var cleanRects = [];
      for (var rect of this._rects) {
        if (rect.x < 0) {
          rect.width += rect.x;
          rect.x = 0;
        }
        if (rect.y < 0) {
          rect.height += rect.y;
          rect.y = 0;
        }
        if (rect.width + rect.x > this._width) rect.width = this._width - rect.x;
        if (rect.height + rect.y > this._height) rect.height = this._height - rect.y;
        if (rect.y < this._height && rect.x < this._width) cleanRects.push(rect);
      }
      this._draw(this._ctx, cleanRects);
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

class TextMeasuring {
  /**
   * @param {function(string):number} measure
   */
  constructor(measure) {
    this._lineMetrics = new WeakMap();
    this._charWidths = {};
    /** @type {function(string):number} */
    this._measure = text => {
      var width = 0;
      for (var i = 0; i < text.length; i++) {
        var char = text.charAt(i);
        var charIndex = char.charCodeAt(0);
        if (!(charIndex in this._charWidths)) this._charWidths[charIndex] = measure(char);
        width += this._charWidths[charIndex];
      }
      return width;
    };
    this._longestLineLength = 0;
  }

  longestLineLength() {
    return this._longestLineLength;
  }

  /**
   * @param {?import('./model').Line} line
   * @param {number} column
   * @return {number}
   */
  xOffsetFromLocation(line, column) {
    if (!line) return 0;
    var metrics = this._computeLineMetrics(line);
    var alpha = 0;
    var beta = metrics.length - 1;
    var diff = Infinity;
    var lastIndex = 0;
    var index = 0;
    var value;
    while (beta >= alpha) {
      lastIndex = index;
      index = Math.floor((alpha + beta) / 2);
      value = metrics[index];
      if (value.column === column) return value.offset;
      if (column > value.column) alpha = index + 1;
      else beta = index - 1;
    }

    if (Math.abs(value.column - column) > Math.abs(metrics[lastIndex].column - column)) {
      index = lastIndex;
      value = metrics[index];
    }
    var offset =
      column > value.column
        ? value.offset + this._measure(line.text.substring(value.column, column))
        : value.offset - this._measure(line.text.substring(column, value.column));
    metrics.splice(index, 0, { column, offset });
    return offset;
  }

  /**
   * @param {import('./model').Line} line
   * @return {Array<{column: number, offset: number}>}
   */
  _computeLineMetrics(line) {
    if (this._lineMetrics.has(line)) return this._lineMetrics.get(line);
    var metrics = [{ column: 0, offset: 0 }];
    var text = line.text;
    var offset = 0;
    for (var index = 0; index < text.length; index++) {
      offset += this._measure(text[index]);
      if (!(index % 200) || index === text.length - 1) metrics.push({ column: index + 1, offset });
    }
    if (offset > this._longestLineLength) this._longestLineLength = offset;
    this._lineMetrics.set(line, metrics);
    return metrics;
  }
}

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

function hasFocus(element) {
  let active = document.activeElement;
  while (active) {
    if (active === element)
      return true;
      active = active.parentElement;
  }
  return false;
}