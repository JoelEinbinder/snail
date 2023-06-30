import { Emitter } from "./emitter";
import { isSelectionCollapsed, type Loc, type Model, type Line, type TextRange } from "./model";
import type { EditorOptions } from "./editor";
import type { Highlighter } from "./highlighter";

export class Renderer extends Emitter<{
  'might-resize': void,
  'contentMouseDown': MouseEvent,
  'scroll': void,
}> {
  TAB = '  ';
  private _debugPainting = false;
  private _padding: any;
  private _scrollTop: number;
  private _scrollLeft: number;
  private _refreshScheduled: boolean;
  private _hasFocus: boolean;
  private _textLayer: Layer;
  private _overlayLayer: Layer;
  private _lineHeight: number;
  private _width: any;
  private _highlightWordOccurrences: boolean;
  private _scrollingElement: HTMLDivElement;
  private _fillerElement: HTMLDivElement;
  private _lastScrollOffset: { top: number; left: number; };
  colors: EditorOptions['colors'] & {};
  private _textMeasuring: TextMeasuring;
  private _highlightRanges: HighlightRanges = [];
  private _charWidth: any;
  private _height: number;
  private _charHeight: number;
  private _hoverTimer?: ReturnType<typeof setTimeout>;
  private _hoverElement = document.createElement('div');
  private _lineWrappings = new WeakMap<Line, { indent: number, length: number }[]>();
  constructor(
    private _model: Model,
    public element: HTMLElement,
    private _highlighter: Highlighter,
    private _options: EditorOptions = {},
  ) {
    super();

    this._padding = typeof this._options.padding === 'number' ? this._options.padding : 4;
    this._scrollTop = 0;
    this._scrollLeft = 0;
    this._refreshScheduled = false;
    this._hoverElement.classList.add('editor-hover');
    this._hoverElement.style.position = 'absolute';
    this._hoverElement.style.pointerEvents = 'none';

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

    this.element.appendChild(this._textLayer.canvas);
    this.element.appendChild(this._overlayLayer.canvas);

    if (this._options.inline) this._options.padBottom = false;
    var lineCount = 1;
    this._model.on('change', () => {
      this._clearHover();
      if (this._model.lineCount() === lineCount && !this._options.wordWrap) return;
      if (this._options.inline) this.layout();
      else {
        const from = Math.min(lineCount, this._model.lineCount());
        const to = Math.max(lineCount, this._model.lineCount());
        const y = Math.floor(this._yOffsetFromLocation({line: from, column: 0}) - this.scrollTop) - 1;
        const height = Math.ceil(this._yOffsetFromLocation({ line: to + 1, column: 0}) - this.scrollTop - y) + 2;
        this._textLayer.invalidate({ x: 0, y, width: this._width, height });
        this.scheduleRefresh();
      }
      lineCount = this._model.lineCount();
    });

    var lastDpr = getDPR();
    window.addEventListener(
      'resize',
      event => {
        const dpr = getDPR();
        if (lastDpr === dpr) return;
        lastDpr = dpr;
        this.layout();
      },
      false
    );

    this._highlighter.on('highlight', ({ from, to }) => {
      var viewport = this.viewport();
      if (viewport.from <= to && from <= viewport.to) {
        var y = Math.floor(this._yOffsetFromLocation({line: from, column: 0})  - this.scrollTop) - 1;
        var height = Math.ceil(this._yOffsetFromLocation({ line: to + 1, column: 0}) - this.scrollTop - y) + 2;
        this._textLayer.invalidate({
          x: 0,
          y,
          width: this._width,
          height
        });
        this.scheduleRefresh();
      }
    });
    this._model.on('selection-changed', () => {
      this._highlightWordOccurrences = false;
      this._overlayLayer.invalidate();
      this._overlayLayer.refresh();
      this._clearHover();
    });
    this._model.on('squiggliesChanged', () => {
      this._overlayLayer.invalidate();
      this._overlayLayer.refresh();
    });

    this._scrollingElement = document.createElement('div');
    if (this._options.inline) {
      this._scrollingElement.style.overflowX = 'auto';
      this._scrollingElement.style.overflowY = 'hidden';
    } else {
      this._scrollingElement.style.overflow = 'auto';
    }
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
    this.element.addEventListener('mouseleave', () => this._clearHover());
    this.element.addEventListener('mousemove', event => this._startHoverTimer(event));
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

  _startHoverTimer(event: MouseEvent) {
    const updateHover = () => {
      delete this._hoverTimer;
      const loc = this.locationFromPoint(event.clientX, event.clientY);
      const hover = this._highlighter.hoverForLocation(loc);
      if (!hover) {
        this._clearHover();
        return;
      }
      this._hoverElement.textContent = '';
      this._hoverElement.append(hover.content);
      this.element.append(this._hoverElement);
      const point = this.pointFromLocation(hover.reposition);
      this._hoverElement.style.left = `${Math.round(point.x)}px`;
      const y = loc.line === 0 ? point.y + this._lineHeight : point.y - this._hoverElement.offsetHeight;
      this._hoverElement.style.top = `${Math.round(y)}px`;
    };

    const hasHover = this._hoverElement.isConnected;
    this._clearHover();
    if (hasHover) updateHover()
    else this._hoverTimer = setTimeout(updateHover, 500);
  }

  _clearHover() {
    if (this._hoverTimer) {
      clearTimeout(this._hoverTimer);
      delete this._hoverTimer;
    }
    this._hoverElement.remove();
  }

  highlightWordOccurrences() {
    if (!this._options.highlightWordOccurrences)
      return;
    this._highlightWordOccurrences = true;
    this._overlayLayer.invalidate();
    this._overlayLayer.refresh();
  }

  setText(text: string) {
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

  locationFromPoint(offsetX: number, offsetY: number): Loc {
    var rect = this._scrollingElement.getBoundingClientRect();
    offsetY += this._scrollTop - rect.top;
    if (offsetY < 0) {
      return {
        line: 0,
        column: 0
      };
    }
    let lineNumber = 0;
    let lineOffset = 0;
    for (; lineNumber < this._model.lineCount(); lineNumber++) {
      lineOffset += this._heightForLine(lineNumber);
      if (lineOffset >= offsetY)
        break;
    }
    if (lineNumber >= this._model.lineCount()) {
      return {
        line: this._model.lineCount() - 1,
        column: this._model.line(this._model.lineCount() - 1).length
      };
    }

    const line = this._model.line(lineNumber);
    const wrapping = this._wrappingForLine(lineNumber);
    const wrappedLine = Math.min(wrapping.length - 1, wrapping.length - Math.ceil((lineOffset - offsetY) / this._lineHeight));
    let wrappedStart = 0;
    for (let i = 0; i < wrappedLine; i++) {
      wrappedStart += wrapping[i].length;
    }
    const wrappedXAmount = this._textMeasuring.xOffsetFromLocation(line, wrappedStart);
    
    var x = offsetX - this._padding + this._scrollLeft - rect.left + wrappedXAmount;
    var alpha = wrappedStart;
    var beta = wrappedStart + wrapping[wrappedLine].length;
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

  scrollLocationIntoView(location: Loc) {
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

  pointFromLocation(location: Loc): { x: number; y: number; } {
    if (location.line >= this._model.lineCount()) location = this._model.fullRange().end;
    return {
      x: this._xOffsetFromLocation(location) + this._leftOffset(),
      y: this._yOffsetFromLocation(location) - this._scrollTop
    };
  }

  _leftOffset() {
    return this._lineNumbersWidth() + this._padding - this.scrollLeft;
  }

  _gutterWheel(event: WheelEvent) {
    const node = event.target as Node;
    if (node === this._scrollingElement || this._scrollingElement.contains(node)) return;
    const deltaY = event.deltaY;
    const deltaX = event.deltaX;
    if (Math.abs(deltaX) > Math.abs(deltaY)) this._scrollingElement.scrollLeft += deltaX;
    else this._scrollingElement.scrollTop += deltaY;
  }

  _onScroll() {
    const dpr = getDPR();
    this._scrollTop = Math.round(this._scrollingElement.scrollTop * dpr) / dpr;
    this._scrollLeft =
      Math.round(this._scrollingElement.scrollLeft * dpr) / dpr;
    const rects: Rect[] = [];
    const deltaX = this.scrollLeft - this._lastScrollOffset.left;
    const deltaY = this.scrollTop - this._lastScrollOffset.top;
    if (deltaX > 0) {
      rects.push({ x: this._width - deltaX - 1, y: 0, width: deltaX + 1, height: this._height });
      rects.push({ x: 0, y: 0, width: this._lineNumbersWidth() + 1, height: this._height });
    }
    if (deltaX < 0) rects.push({ x: 0, y: 0, width: this._lineNumbersWidth() + 1 - deltaX + 1, height: this._height });
    if (deltaY > 0) rects.push({ x: 0, y: this._height - deltaY - 1, width: this._width, height: deltaY + 1 });
    if (deltaY < 0) rects.push({ x: 0, y: 0, width: this._width, height: -deltaY + 1 });
    this._textLayer.translate(deltaX, deltaY);
    this._overlayLayer.translate(deltaX, deltaY);
    for (const rect of rects) {
      this._textLayer.invalidate(rect);
      this._overlayLayer.invalidate(rect);
    }
    this.scheduleRefresh();
    this._lastScrollOffset = {
      top: this.scrollTop,
      left: this.scrollLeft
    };
    this._clearHover();
    this.emit('scroll', undefined);
  }

  _innerHeight() {
    return this._yOffsetFromLocation({ line: this._model.lineCount(), column: 0 });
  }

  _innerWidth() {
    if (this._options.wordWrap)
      return this._width;
    return this._textMeasuring.longestLineLength() + this._padding * 2;
  }

  refresh() {
    if (!this.element.isConnected)
      return;
    if (!this._lineHeight || !this._charWidth)
      this.layout();
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

  _lineForOffset(y: number) {
    if (!this._options.wordWrap)
      return Math.floor(y / this._lineHeight);
    if (y < 0)
      return 0;
    let lineNumber = 0;
    let lineOffset = 0;
    for (; lineNumber < this._model.lineCount(); lineNumber++) {
      lineOffset += this._heightForLine(lineNumber);
      if (lineOffset >= y)
        break;
    }
    return Math.min(this._model.lineCount() - 1, lineNumber);
  }

  _drawText(ctx: CanvasRenderingContext2D, clipRects: Rect[]) {
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
    const farLeft = lineNumbersWidth + this._padding - this.scrollLeft;
    for (var i = viewport.from; i <= viewport.to; i++) {
      var rect = {
        x: farLeft,
        y: this._yOffsetFromLocation({ line: i, column: 0 }),
        width: Infinity,
        height: this._lineHeight,
      };
      if (!clipRects.some(clipRect => intersects(rect, clipRect))) continue;
      rect.width = 0;
      var text = this._model.line(i).text;
      let index = 0;
      const wrapping = this._wrappingForLine(i);
      const tokens = [...this._highlighter.tokensForLine(i)].reverse();
      outer: for (const wrap of wrapping) {
        let lastX = this._textMeasuring.xOffsetFromLocation(this._model.line(i), index);
        let charsLeftInWrap = wrap.length;
        tokenLoop: while (true) {
          const token = tokens.pop();
          if (!token)
            break;
          for (var j = 0; j < token.length; j += CHUNK_SIZE) {
            var start = index + j;
            var end = index + Math.min(j + CHUNK_SIZE, token.length, charsLeftInWrap);
            var chunk = text.substring(start, end).replace(/\t/g, this.TAB);
            rect.width = this._textMeasuring.xOffsetFromLocation(this._model.line(i), end) - lastX;
            if (clipRects.some(clipRect => intersects(rect, clipRect))) {
              if (token.background) {
                ctx.fillStyle = token.background;
                ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
              }
              ctx.fillStyle = token.color || this.colors.foreground;
              ctx.fillText(chunk, rect.x, rect.y + this._charHeight);
            }
            rect.x += rect.width;
            lastX += rect.width;
            if (!this._options.wordWrap && rect.x > farRight) break outer;
            charsLeftInWrap -= end - start;
            if (charsLeftInWrap === 0) {
              const tokenRemaining = token.length - (end - start);
              if (tokenRemaining > 0)
                tokens.push({
                  ...token,
                  length: tokenRemaining,
                });
              index = end;
              break tokenLoop;
            }
          }
          index += token.length;
        }
        rect.y += this._lineHeight;
        rect.x = farLeft;
      }
    }
    if (this._options.lineNumbers) this._drawLineNumbers(ctx);
  }

  _drawOverlay(ctx: CanvasRenderingContext2D, clipRects: Rect[]) {
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
    ctx.save();
    ctx.fillStyle = this.colors.selectionBackground;
    ctx.globalAlpha = 0.4;
    if (word) {
      var viewport = this.viewport();
      for (var i = viewport.from; i <= viewport.to; i++) {
        var text = this._model.line(i).text.toLowerCase();
        var index = -1;
        while ((index = text.indexOf(word, index + 1)) !== -1) {
          if (this._model.selections.some(selection => {
            return i === selection.start.line &&
            index === selection.start.column &&
            index + word.length === selection.end.column
          })) continue;            
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
    ctx.restore();

    for (const squiggly of this._model.squigglies) {
      ctx.strokeStyle = squiggly.color;
      for (let line = squiggly.range.start.line; line <= squiggly.range.end.line && line < this._model.lineCount(); line++) {
        let start = line === squiggly.range.start.line ? squiggly.range.start.column : 0;
        let end = line === squiggly.range.end.line ? squiggly.range.end.column : this._model.line(line).text.length;
        const point = this.pointFromLocation({ line, column: start });
        const otherPoint = this.pointFromLocation({ line, column: end });
        ctx.beginPath();
        const y = point.y + this._lineHeight - 1;
        ctx.moveTo(point.x, y);
        const width = 2;
        let upStroke = true
        for (let x = point.x + width; x < otherPoint.x; x += width) {
          ctx.lineTo(x, y + (upStroke ? -2 : 0));
          upStroke = !upStroke;
        }
        ctx.stroke();
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

    for (const { color, range } of this._highlightRanges) {
      ctx.fillStyle = color;
      for (let line = range.start.line; line <= range.end.line && line < this._model.lineCount(); line++) {
        let start = line === range.start.line ? range.start.column : 0;
        let end = line === range.end.line ? range.end.column : this._model.line(line).text.length;
        const point = this.pointFromLocation({ line, column: start });
        const otherPoint = this.pointFromLocation({ line, column: end });
        ctx.fillRect(
          point.x,
          point.y,
          otherPoint.x - point.x,
          this._lineHeight
        );
      }
    }
  }

  setHighlightRanges(ranges: HighlightRanges) {
    this._highlightRanges = ranges;
    this._overlayLayer.invalidate();
    if (!this.element.isConnected)
      return;
    this._overlayLayer.refresh();
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

  _drawLineNumbers(ctx: CanvasRenderingContext2D) {
    var width = this._lineNumbersWidth();
    ctx.fillStyle = this.colors.gutterBackground || '#eeeeee';
    ctx.fillRect(0, 0, width, this._height);
    ctx.fillStyle = this.colors.gutterBorder || '#bbbbbb';
    ctx.fillRect(width - 1, 0, 1, this._height);

    ctx.fillStyle = this.colors.gutterForeground || 'rgb(128, 128, 128)';
    var { from, to } = this.viewport();
    for (var i = from; i <= to; i++) {
      ctx.fillText(
        String(i + 1),
        width - ctx.measureText(String(i + 1)).width - this._padding,
        this._yOffsetFromLocation({ line: i, column: 0}) + this._charHeight - this.scrollTop
      );
    }
  }

  layout() {
    if (!this.element.isConnected)
      return;
    this._charHeight = parseInt(window.getComputedStyle(this._textLayer.canvas).fontSize);
    this._lineHeight = Math.max(parseInt(window.getComputedStyle(this._textLayer.canvas).lineHeight || '0'), this._charHeight);
    var rect = this.element.getBoundingClientRect();
    this._width = rect.width;
    this._height = rect.height;
    this._lineWrappings = new WeakMap();
    this._overlayLayer.layout(rect.width, rect.height);
    this._textLayer.layout(rect.width, rect.height);
    var last = this._charWidth;
    const ctx = this._textLayer.canvas.getContext('2d')!;
    this._charWidth = ctx.measureText('x').width;
    if (this._charWidth !== last)
      this._textMeasuring = new TextMeasuring(
        char => ctx.measureText(char === '\t' ? this.TAB : char).width
      );

    if (this._options.inline) {
      const newHeight = this._innerHeight() + 'px';
      if (newHeight !== this.element.style.height) {
        this.emit('might-resize', undefined);
        this.element.style.height = newHeight;
      }
    }

    if (this._lineHeight && this._charWidth)
      this.refresh();
  }

  get lineHeight() {
    return this._lineHeight;
  }

  get charWidth() {
    return this._charWidth;
  }

  get gutterWidth() {
    return this._lineNumbersWidth() + this._padding;
  }

  _wrappingForLine(lineNumber: number) {
    const line = this._model.line(lineNumber);
    if (!line)
      return [{ indent: 0, length: 0 }];
    if (!this._options.wordWrap)
      return [{ indent: 0, length: line.length }];
    const computeLineWrapping = () => {
      const containerWidth = Math.floor((this._width - this._lineNumbersWidth() - this._padding) / this._charWidth);
      if (containerWidth >= line.length)
        return [{indent: 0, length: line.length}];
      const wrapping: {indent: number, length: number}[] = [];
      for (let i = 0; i < line.length; i += containerWidth) {
        const end = Math.min(line.length, i + containerWidth);
        wrapping.push({ indent: 0, length: end - i });
      }
      return wrapping;
    }
    if (!this._lineWrappings.has(line)) {
      this._lineWrappings.set(line, computeLineWrapping());
    }
    return this._lineWrappings.get(line)!;
  }

  _heightForLine(lineNumber: number) {
    if (!this._options.wordWrap)
      return this._lineHeight;
    return this._wrappingForLine(lineNumber).length * this._lineHeight;
  }

  _yOffsetFromLocation(location: Loc) {
    if (!this._options.wordWrap)
      return location.line * this._lineHeight;
    let totalHeight = 0;
    for (let i = 0; i < location.line; i++)
      totalHeight += this._heightForLine(i);
    const wrapping = this._wrappingForLine(location.line);
    let lineEnd = 0;
    for (let i = 0; i < wrapping.length - 1; i++) {
      lineEnd += wrapping[i].length;
      if (lineEnd > location.column)
        break;
      totalHeight += this._lineHeight;
    }
    return totalHeight;
  }

  _xOffsetFromLocation(location: Loc) {
    const line = this._model.line(location.line);
    if (!this._options.wordWrap)
      return this._textMeasuring.xOffsetFromLocation(line, location.column);
    const wrapping = this._wrappingForLine(location.line);
    let lineStart = 0;
    for (let i = 0; i < wrapping.length; i++) {
      if (i === wrapping.length - 1 || lineStart + wrapping[i].length > location.column)
        return this._textMeasuring.xOffsetFromLocation(line, location.column) - this._textMeasuring.xOffsetFromLocation(line, lineStart);
      lineStart += wrapping[i].length;
    }
    throw new Error('unreachable');
  }
}

class Layer {
  readonly canvas = document.createElement('canvas');
  private _ctx = this.canvas.getContext('2d')!;
  private _rects: Rect[] = [];
  private _width = 0;
  private _height = 0;
  private _dpr = 1;
  private _translation = { x: 0, y: 0 };
  constructor(private _draw: (ctx: CanvasRenderingContext2D, rect: Rect[]) => void) {
    this.canvas.style.setProperty('font-kerning', 'none');
  }

  refresh() {
    if (this.canvas.width === 0 || this.canvas.height === 0)
      return;
    if (this._translation.x || this._translation.y) {
      this._ctx.globalCompositeOperation = 'copy';
      this._ctx.drawImage(this.canvas, -this._translation.x, -this._translation.y);
      this._translation = { x: 0, y: 0 };
      this._ctx.globalCompositeOperation = 'source-over';
    }
    if (this._rects.length) {
      this._ctx.save();
      this._ctx.scale(this._dpr, this._dpr);
      const cleanRects: Rect[] = [];
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

  invalidate(rect?: Rect) {
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

  layout(width: number, height: number) {
    var dpr = getDPR();
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

  translate(x: number, y: number) {
    for (var rect of this._rects) {
      rect.x -= x;
      rect.y -= y;
    }
    this._translation.x += Math.round(x * this._dpr);
    this._translation.y += Math.round(y * this._dpr);
  }
}

class TextMeasuring {
  private _lineMetrics = new WeakMap<Line, { column: number; offset: number; }[]>();
  private _charWidths = {};
  private _measure: (text: string) => number;
  private _longestLineLength: number;
  constructor(measure: (arg0: string) => number) {
    this._measure = (text: string): number => {
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

  xOffsetFromLocation(line: Line | null, column: number): number {
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

  _computeLineMetrics(line: Line): { column: number; offset: number; }[] {
    if (this._lineMetrics.has(line)) return this._lineMetrics.get(line)!;
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

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function intersects(a: Rect, b: Rect): boolean {
  return a.x + a.width > b.x && b.x + b.width > a.x && a.y + a.height > b.y && b.y + b.height > a.y;
}

function contains(inside: Rect, outside: Rect): boolean {
  return (
    inside.x >= outside.x &&
    inside.x + inside.width <= outside.x + outside.width &&
    inside.y >= outside.y &&
    inside.y + inside.height <= outside.y + outside.height
  );
}

function combineRects(...rects: Rect[]): Rect {
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

const isWebKit = /WebKit/.test(navigator.userAgent);
const isChrome = /Chrome/.test(navigator.userAgent);
function getDPR() {
  if (isChrome)
    return window.devicePixelRatio;
  if (isWebKit) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('version', '1.1');
    document.body.appendChild(svg);
    const dpr = svg.currentScale * window.devicePixelRatio;
    svg.remove();
    return dpr;
  }
  return window.devicePixelRatio;
}

export type HighlightRanges = {
  range: TextRange;
  color: string;
}[];
