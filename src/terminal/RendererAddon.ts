import type { Terminal, ITerminalAddon, IEvent } from 'xterm';
import type { IRenderService } from 'xterm/src/browser/services/Services';
import type { IColorSet } from 'xterm/src/browser/Types';
import type { Terminal as CoreTerminal } from 'xterm/src/browser/Terminal';
import type { IRenderDimensions, IRenderer, IRequestRedrawEvent } from 'xterm/src/browser/renderer/Types';
import { makeTextDrawer } from './TextLayer';
import './rendererAddon.css';
import type { IBufferService, ICoreService } from 'xterm/src/common/services/Services';
import { CellData } from 'xterm/src/common/buffer/CellData';
import { FindService, type FindState } from './FindService';
import type { Findable, FindParams } from '../Find';

export class RendererAddon implements ITerminalAddon, Findable {
  private _terminal: Terminal;
  private _renderer: Renderer;
  private _findService: FindService;
  constructor() {
  }
  activate(terminal: Terminal): void {
    if (!terminal.element)
      throw new Error('Cannot activate RendererAddon before Terminal.open');
    this._terminal = terminal;
    const renderService: IRenderService = (terminal as any)._core._renderService;
    this._renderer = new Renderer(this._terminal);
    renderService.setRenderer(this._renderer);
    this._findService = new FindService(this._terminal, state => this._renderer.setFindState(state));
  }
  dispose(): void {
  }
  onScroll() {
    this._renderer.onScroll();
  }
  get bottomBlankRows(): number {
    return this._renderer?.bottomBlankRows;
  }
  setFind(params: FindParams): void {
    this._findService.setFind(params);
  }
}

class Renderer implements IRenderer {
  dimensions: IRenderDimensions = {
    scaledCharWidth: 0,
    scaledCharHeight: 0,
    scaledCellWidth: 0,
    scaledCellHeight: 0,
    scaledCharLeft: 0,
    scaledCharTop: 0,
    scaledCanvasWidth: 0,
    scaledCanvasHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    actualCellWidth: 0,
    actualCellHeight: 0
  }
  private _devicePixelRatio = getDPR();
  private _core: CoreTerminal;
  private _canvas = document.createElement('canvas');
  private _cursor = document.createElement('div');
  private _isAttached = false;
  private _textLayer: Layer;
  private _bottomBlankRows = 0;
  private _scrollOffset = 0;
  get bottomBlankRows(): number { return this._bottomBlankRows; }
  private _workCell = new CellData();
  private _selectionState: {
    start: [number, number],
    end: [number, number],
    columnSelectMode: boolean,
  }|undefined;
  private _findState: FindState = { activeMatch: -1, matches: [] };
  constructor(private _terminal: Terminal) {
    this._core = (this._terminal as any)._core;
    this._textLayer = new Layer(makeTextDrawer(
      (this._core as any)._bufferService,
      (this._core as any)._characterJoinerService,
      (this._core as any)._colorManager.colors,
      (this._core as any).optionsService,
      () => this._selectionState,
      this.dimensions,
      () => this._getScrollOffset() * getDPR(),
      () => this._findState,
      ));

    this._updateDimensions();
    this._cursor.classList.add('cursor');
    this._core.screenElement!.append(this._canvas, this._cursor);
    this.onCharSizeChanged();
  }
  private _redrawListeners = new Set<(event: IRequestRedrawEvent) => void>(); 
  onRequestRedraw: IEvent<IRequestRedrawEvent> = listener => {
    this._redrawListeners.add(listener);
    return {
      dispose: () => this._redrawListeners.delete(listener)
    }
  };
  dispose(): void {
  }
  setColors(colors: IColorSet): void {
    // refresh will be called after this
  }
  onDevicePixelRatioChange(): void {
    const dpr = getDPR();
    this._devicePixelRatio = dpr;
    this.onResize(this._terminal.cols, this._terminal.rows);
  }
  onResize(cols: number, rows: number): void {
    this._updateDimensions();
    this._ensureCanvasSizeConsideringBlankRows();
    this._updateCursor();
  }
  private _requestRedraw() {
    this._redrawListeners.forEach(listener => listener({ start: 0, end: this._terminal.rows - 1 }));
  }
  private _ensureCanvasSizeConsideringBlankRows() {
    this._updateBottomBlankRows();
    const effectiveRows = this._terminal.buffer.active.length - this._bottomBlankRows;
    this._core.screenElement.style.height = `${effectiveRows * this.dimensions.actualCellHeight}px`;
    const rows = Math.min(effectiveRows, this._terminal.rows + 1);
    this._canvas.style.height = `${rows * this.dimensions.actualCellHeight}px`;
    this._canvas.style.width = `${this.dimensions.canvasWidth}px`;
    this._canvas.width = this.dimensions.scaledCanvasWidth;
    this._canvas.height = this.dimensions.scaledCellHeight * rows;
    this._textLayer.layout(this.dimensions.scaledCanvasWidth, rows * this.dimensions.scaledCellHeight);
  }
  onCharSizeChanged(): void {
    this.onResize(this._terminal.cols, this._terminal.rows);
    this._requestRedraw();
  }
  onBlur(): void {
  }
  onFocus(): void {
  }
  onScroll(): void {
    this._doRender();
  }
  onSelectionChanged(start: [number, number]|undefined, end: [number, number]|undefined, columnSelectMode: boolean): void {
    if (!start || !end)
      delete this._selectionState;
    else
      this._selectionState = { start, end, columnSelectMode };
    this._requestRedraw();
  }
  onCursorMove(): void {
    this._updateCursor();
    if (isAncesetorOf(this._terminal.element, this._terminal.element.ownerDocument.activeElement)) {
      // TODO make this work for firefox?
      // @ts-ignore
      this._cursor.scrollIntoViewIfNeeded?.();
    }
  }
  private _updateCursor() {
    const cursorPosition = this._cursorPosition();
    if (cursorPosition) {
      this._cursor.style.display = 'block';
      this._cursor.style.left = `${cursorPosition.x * this.dimensions.actualCellWidth}px`;
      this._cursor.style.top = `${cursorPosition.y * this.dimensions.actualCellHeight}px`;
      this._cursor.style.width = `${cursorPosition.width * this.dimensions.actualCellWidth}px`;
      this._cursor.style.height = `${this.dimensions.actualCellHeight}px`;
    } else {
      this._cursor.style.display = 'none';
    }
  }
  private _cursorPosition(): { x: number, y: number, width: number }|null {
    if (!this._terminal.enabled)
      return null;
    const coreService: ICoreService = (this._core as any).coreService;
    // Don't draw the cursor if it's hidden
    if (!coreService.isCursorInitialized || coreService.isCursorHidden) {
      return null;
    }
    const bufferService: IBufferService = (this._core as any)._bufferService;
    const cursorY = bufferService.buffer.ybase + bufferService.buffer.y;

    // in case cursor.x == cols adjust visual cursor to cols - 1
    const cursorX = Math.min(bufferService.buffer.x, bufferService.cols - 1);
    bufferService.buffer.lines.get(cursorY)!.loadCell(cursorX, this._workCell);
    if (this._workCell.content === undefined)
      return null;
    return { x: cursorX, y: cursorY, width: this._workCell.getWidth() };
  }


  onOptionsChanged(): void {
    this.onResize(this._terminal.cols, this._terminal.rows);
    this._requestRedraw();
  }
  clear(): void {
    throw new Error('Method not implemented: clear');
  }
  renderRows(start: number, end: number): void {
    if (!this._isAttached) {
      if (document.body.contains(this._core.screenElement!) && (this._core as any)._charSizeService.width && (this._core as any)._charSizeService.height) {
        this._updateDimensions();
        // this._refreshCharAtlas();
        this._isAttached = true;
      } else {
        return;
      }
    }
    this._ensureCanvasSizeConsideringBlankRows();
    this._textLayer.invalidate({
      x: 0,
      y: start * this.dimensions.actualCellHeight,
      width: this.dimensions.canvasWidth,
      height: (end - start) * this.dimensions.actualCellHeight
    });
    this._doRender();
  }

  private _doRender() {
    if (!this._canvas.height)
      return;
    const lastScrollOffset = this._scrollOffset;
    this._scrollOffset = Math.max(-this._core.screenElement.getBoundingClientRect().top, 0);
    this._canvas.style.top = `${this._scrollOffset}px`;
    this._textLayer.translate(0, (this._scrollOffset - lastScrollOffset) * getDPR());
    this._textLayer.refresh();
    const ctx = this._canvas.getContext('2d')!;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.drawImage(this._textLayer.canvas, 0, 0);
  }

  clearTextureAtlas(): void {
    this._requestRedraw();
  }
  
  /**
   * Recalculates the character and canvas dimensions.
   */
  private _updateDimensions(): void {
    // TODO: Acquire CharSizeService properly

    // Perform a new measure if the CharMeasure dimensions are not yet available
    if (!(this._core as any)._charSizeService.width || !(this._core as any)._charSizeService.height) {
      return;
    }

    // Calculate the scaled character width. Width is floored as it must be
    // drawn to an integer grid in order for the CharAtlas "stamps" to not be
    // blurry. When text is drawn to the grid not using the CharAtlas, it is
    // clipped to ensure there is no overlap with the next cell.

    // NOTE: ceil fixes sometime, floor does others :s

    this.dimensions.scaledCharWidth = Math.floor((this._core as any)._charSizeService.width * this._devicePixelRatio);

    // Calculate the scaled character height. Height is ceiled in case
    // devicePixelRatio is a floating point number in order to ensure there is
    // enough space to draw the character to the cell.
    this.dimensions.scaledCharHeight = Math.ceil((this._core as any)._charSizeService.height * this._devicePixelRatio);

    // Calculate the scaled cell height, if lineHeight is not 1 then the value
    // will be floored because since lineHeight can never be lower then 1, there
    // is a guarentee that the scaled line height will always be larger than
    // scaled char height.
    this.dimensions.scaledCellHeight = Math.floor(this.dimensions.scaledCharHeight * this._terminal.getOption('lineHeight'));

    // Calculate the y coordinate within a cell that text should draw from in
    // order to draw in the center of a cell.
    this.dimensions.scaledCharTop = this._terminal.getOption('lineHeight') === 1 ? 0 : Math.round((this.dimensions.scaledCellHeight - this.dimensions.scaledCharHeight) / 2);

    // Calculate the scaled cell width, taking the letterSpacing into account.
    this.dimensions.scaledCellWidth = this.dimensions.scaledCharWidth + Math.round(this._terminal.getOption('letterSpacing'));

    // Calculate the x coordinate with a cell that text should draw from in
    // order to draw in the center of a cell.
    this.dimensions.scaledCharLeft = Math.floor(this._terminal.getOption('letterSpacing') / 2);

    // Recalculate the canvas dimensions; scaled* define the actual number of
    // pixel in the canvas
    this.dimensions.scaledCanvasHeight = this._terminal.rows * this.dimensions.scaledCellHeight;
    this.dimensions.scaledCanvasWidth = this._terminal.cols * this.dimensions.scaledCellWidth;

    // The the size of the canvas on the page. It's very important that this
    // rounds to nearest integer and not ceils as browsers often set
    // window.devicePixelRatio as something like 1.100000023841858, when it's
    // actually 1.1. Ceiling causes blurriness as the backing canvas image is 1
    // pixel too large for the canvas element size.
    this.dimensions.canvasHeight = Math.round(this.dimensions.scaledCanvasHeight / this._devicePixelRatio);
    this.dimensions.canvasWidth = Math.round(this.dimensions.scaledCanvasWidth / this._devicePixelRatio);

    // this.dimensions.scaledCanvasHeight = this.dimensions.canvasHeight * devicePixelRatio;
    // this.dimensions.scaledCanvasWidth = this.dimensions.canvasWidth * devicePixelRatio;

    // Get the _actual_ dimensions of an individual cell. This needs to be
    // derived from the canvasWidth/Height calculated above which takes into
    // account window.devicePixelRatio. CharMeasure.width/height by itself is
    // insufficient when the page is not at 100% zoom level as CharMeasure is
    // measured in CSS pixels, but the actual char size on the canvas can
    // differ.
    // this.dimensions.actualCellHeight = this.dimensions.canvasHeight / this._terminal.rows;
    // this.dimensions.actualCellWidth = this.dimensions.canvasWidth / this._terminal.cols;

    // This fixes 110% and 125%, not 150% or 175% though
    this.dimensions.actualCellHeight = this.dimensions.scaledCellHeight / this._devicePixelRatio;
    this.dimensions.actualCellWidth = this.dimensions.scaledCellWidth / this._devicePixelRatio;
  }

  private _updateBottomBlankRows(): void {
    if (!this._terminal.options.delegatesScrolling || this._terminal.buffer.active !== this._terminal.buffer.normal) {
      this._bottomBlankRows = 0;
      return;
    }
    let blankRows = 0;
    for (let i = 0; i < this._terminal.rows; i++) {
      const y = this._terminal.rows - i - 1;
      if (this._terminal.enabled && y === this._core.buffer.y)
        break;
      if (y < this._core.buffer.y)
        break;
      if (this._core.buffer.lines.get(this._core.buffer.ydisp + y).translateToString(true))
        break;
      blankRows++;
    }
    // TODO: Do something here to fix docker flickering
    // if (this._terminal.enabled)
    //   blankRows = Math.min(blankRows, this._bottomBlankRows);
    this._bottomBlankRows = blankRows;
  }

  private _getScrollOffset() {
    return this._scrollOffset;
  }

  setFindState(findState: FindState): void {
    this._findState = findState;
    this._requestRedraw();
  }
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

class Layer {
  readonly canvas = document.createElement('canvas');
  private _ctx = this.canvas.getContext('2d')!;
  private _rects: Rect[] = [];
  private _width = 0;
  private _height = 0;
  private _translation = { x: 0, y: 0 };
  constructor(private _draw: (ctx: CanvasRenderingContext2D, rect: Rect[]) => void) {
    this.canvas.style.setProperty('font-kerning', 'none');
  }

  refresh() {
    if (this.canvas.width === 0 || this.canvas.height === 0)
      return;
    if (this._translation.x || this._translation.y) {
      this._ctx.globalCompositeOperation = 'copy';
      this._ctx.drawImage(this.canvas, -this._translation.x, -Math.round(this._translation.y));
      if (this._translation.x < 0) {
        this.invalidate({
          x: 0,
          y: 0,
          width: -this._translation.x,
          height: this._height
        });
      }
      if (this._translation.y < 0) {
        this.invalidate({
          x: 0,
          y: 0,
          width: this._width,
          height: -this._translation.y
        });
      }
      if (this._translation.x > 0) {
        this.invalidate({
          x: this._width - this._translation.x,
          y: 0,
          width: this._translation.x,
          height: this._height
        });
      }
      if (this._translation.y > 0) {
        this.invalidate({
          x: 0,
          y: this._height - this._translation.y,
          width: this._width,
          height: this._translation.y
        });
      }
      this._translation = { x: 0, y: 0 };
      this._ctx.globalCompositeOperation = 'source-over';
    }
    if (this._rects.length) {
      this._ctx.save();
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
    this.canvas.width = width;
    this.canvas.height = height;
    this._width = width;
    this._height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    var computedStyle = window.getComputedStyle(this.canvas);

    this._ctx.font = `${computedStyle.fontSize} / ${computedStyle.lineHeight} ${computedStyle.fontFamily}`;
    this.invalidate();
  }

  translate(x: number, y: number) {
    for (var rect of this._rects) {
      rect.x -= x;
      rect.y -= y;
    }
    this._translation.x += x;
    this._translation.y += y;
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

function isAncesetorOf(ancestor: Node, child: Node) {
  while (child) {
    if (child === ancestor) return true;
    child = child.parentNode!;
  }
  return false;
}