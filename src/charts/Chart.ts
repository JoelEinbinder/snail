import { themeBackgroundColor, themeTextColor } from "../theme";
import type { ProcessedData } from "./Dataset";
import { makeIconCheckbox } from "./IconCheckbox";
import { showTooltip } from "./Tooltip";
import './chart.css';

const background = themeBackgroundColor();
const foreground = '#e8710a';
const majorAxisColor = '#999';
const textColor = themeTextColor();
const minorAxisColor = '#444';
const zeroAxisScolor = '#777';
const selectionInnerColor = 'rgba(128,128,128,0.1)';
const selectionBorderColor = majorAxisColor;

class Layer {
  private canvas = document.createElement('canvas');
  private needsUpdate = true;
  constructor(width: number,
    height: number,
    private draw: (ctx: CanvasRenderingContext2D) => void) {
      this.canvas.width = width;
      this.canvas.height = height;
  }
  get() {
    if (this.needsUpdate) {
      this.draw(this.canvas.getContext('2d'));
      this.needsUpdate = false;
    }
    return this.canvas;
  }
  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.needsUpdate = true;
  }
  invalidate() {
    this.needsUpdate = true;
  }
}

class RunOnceEventaully {
  private timer: number;
  run(callback: () => void, time: number) {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = window.setTimeout(() => {
      delete this.timer;
      callback();
    }, time);
  }
}
export type LineOptions = {
  color?: string;
  name?: string;
}
export class Line {
  private _color: string;
  private _name: string;
  private _listeners = new Set<(item: ProcessedData[0]) => void>();
  data: ProcessedData = [];
  constructor(options: LineOptions = {}) {
    const {color = '#e8710a', name = ''} = options;
    this._color = color;
    this._name = name;
  }

  appendData(data: ProcessedData) {
    if (data.length > 1) {
      for (const item of data)
        this.appendData([item]);
      return;
    }
    if (data.length === 0)
      return;
    const item = data[0];
    // fast case is adding to the end
    for (let i = this.data.length - 1; i >= 0; i--) {
      if (this.data[i].step <= item.step) {
        this.data.splice(i + 1, 0, item);
        this.didUpdate(item);
        return;
      }
    }
    // item goes at the start
    this.data.unshift(item);
    this.didUpdate(item);
  }

  get color() {
    return this._color;
  }

  private didUpdate(item: ProcessedData[0]) {
    for (const listener of this._listeners)
      listener(item);
  }

  addListener(listener: (item: ProcessedData[0]) => void) {
    this._listeners.add(listener);
  }

  removeListener(listener: (item: ProcessedData[0]) => void) {
    this._listeners.delete(listener);
  }

  static colorForIndex(index: number) {
    const colors = [
      '#e8710a',
      '#e8b10a',
      '#e8e10a',
      '#a8e10a',
      '#10e8a8',
    ];
    return colors[index % colors.length];
  }
}
export type ChartOptions = {
  hotreloadChart?: Chart;
  allowNormalScrolling?: boolean;
  title?: string;
}
export class Chart {
  element = document.createElement('div');
  private canvas = document.createElement('canvas');
  private canvasContainer = document.createElement('div');
  private ctx = this.canvas.getContext('2d');
  private smooth = 0;
  private margin = 50;
  private autoBounds = {
    x: [0, 0],
    y: [Infinity, -Infinity]
  }
  private xLog = false;
  private yLog = false;
  private scheduledDraw = false;
  private userBounds?: {x: [number, number], y: [number, number]};
  private dataRect: {top: number, left: number, width: number, height: number};
  private smoothForItem = new WeakMap<ProcessedData[0], number>();
  private dataLayer: Layer;
  private hoverItems: {data: ProcessedData[0], line: Line}[] | undefined;
  private selectionRect: {x: number, y: number, x2: number, y2: number} | undefined;
  private eventually = new RunOnceEventaully();
  private lines = new Set<Line>();
  constructor(options: ChartOptions = {}) {
    if (options.hotreloadChart) {
      this.smooth = options.hotreloadChart.smooth;
      this.userBounds = JSON.parse(JSON.stringify(options.hotreloadChart.userBounds));
      this.xLog = options.hotreloadChart.xLog;
      this.yLog = options.hotreloadChart.yLog;
    }
    this.element.classList.add('chart');
    if (options.title) {
      const titleElement = document.createElement('div');
      titleElement.classList.add('title');
      titleElement.textContent = options.title;
      this.element.appendChild(titleElement);
    }
    this.element.appendChild(this.canvasContainer);
    this.canvasContainer.classList.add('canvas-container');
    this.canvasContainer.appendChild(this.canvas);
    const observer = new ResizeObserver(() => {
      this.resized();
    });
    observer.observe(this.canvasContainer);
    const size = 400;
    this.canvas.width = size * window.devicePixelRatio;
    this.canvas.height = size * window.devicePixelRatio;
    this.dataRect = {
      top: 0,
      left: this.margin,
      width: this.canvas.width / window.devicePixelRatio - this.margin,
      height: this.canvas.height / window.devicePixelRatio - this.margin,
    };

    const toolbar = document.createElement('div');
    toolbar.classList.add('toolbar');
    this.element.appendChild(toolbar);
    const smoothSlider = document.createElement('input');
    smoothSlider.type = 'range';
    smoothSlider.min = '0';
    smoothSlider.max = '0.999';
    smoothSlider.step = '0.01';
    smoothSlider.title = 'Smoothing';
    smoothSlider.value = String(this.smooth);
    smoothSlider.classList.toggle('active', this.smooth > 0);
    smoothSlider.oninput = () => {
      this.smooth = Number(smoothSlider.value);
      smoothSlider.classList.toggle('active', this.smooth > 0);
      this.dataOrBoundsChanged();
    }
    toolbar.appendChild(smoothSlider);
    this.canvas.addEventListener('wheel', event => {
      if (options.allowNormalScrolling && !event.altKey && !event.ctrlKey && !event.metaKey) {
        return;
      }
      const center = {
        x: event.offsetX - this.dataRect.left,
        y: event.offsetY - this.dataRect.top,
      };
      this.userBounds = {
        x: this.bounds.x.map(x => center.x + (this.getXPoint(x) - center.x) * 1.001 ** event.deltaY).map(x => this.xToValue(x)) as [number, number],
        y: this.bounds.y.map(y => center.y + (this.getYPoint(y) - center.y) * 1.001 ** event.deltaY).map(y => this.yToValue(y)) as [number, number]
      }
      autofitCheckbox.checked = false;
      this.dataOrBoundsChanged();
      event.preventDefault();
    }, {passive: false});

    let lastTooltip;
    const clearFocusedPoint = () => {
      delete this.hoverItems;
      if (lastTooltip)
        lastTooltip();
      lastTooltip = undefined;
      this.scheduleDraw();
    }
    this.canvas.addEventListener('pointerout', () => {
      clearFocusedPoint();
      delete this.selectionRect;
    });
    this.canvas.addEventListener('pointerdown', event => {
      if (!selectRectCheckbox.checked)
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.selectionRect = {
        x: event.offsetX,
        y: event.offsetY,
        x2: event.offsetX,
        y2: event.offsetY,
      };
      this.scheduleDraw();
    });
    this.canvas.addEventListener('pointerup', event => {
      if (!this.selectionRect)
        return;
      if (this.selectionRect.y != this.selectionRect.y2 && this.selectionRect.x != this.selectionRect.x2) {
        const minx = Math.min(this.selectionRect.x, this.selectionRect.x2);
        const maxx = Math.max(this.selectionRect.x, this.selectionRect.x2);
        const miny = Math.min(this.selectionRect.y, this.selectionRect.y2);
        const maxy = Math.max(this.selectionRect.y, this.selectionRect.y2);
        this.userBounds = {
          x: [this.xToValue(minx), this.xToValue(maxx)],
          y: [this.yToValue(maxy), this.yToValue(miny)],
        };
        this.dataOrBoundsChanged();
      }
      selectRectCheckbox.checked = false;
      selectRectCheckbox.onchange(null);
      delete this.selectionRect;
      this.scheduleDraw();
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!event.buttons) {
        if (selectRectCheckbox.checked || event.offsetX < this.dataRect.left || event.offsetY > this.dataRect.top + this.dataRect.height) {
          clearFocusedPoint();
          return; 
        }
        this.hoverItems = [];
        const step = this.xToValue(event.offsetX);
        for (const line of this.lines) {
          let data: ProcessedData[0];
          for (let item of line.data) {
            data = item;
            if (item.step >= step)
              break;
          }
          this.hoverItems.push({data, line});
        }
        const table = document.createElement('table');
        const rect = this.canvas.getBoundingClientRect();
        const heading = document.createElement('tr');
        table.append(heading);
        const data: {[key: string]: number[]} = {
          Step: this.hoverItems.map(h => h.data.step),
          Value: this.hoverItems.map(h => h.data.value),
        };
        if (this.smooth > 0) {
          data.Smoothed = this.hoverItems.map(h => this.smoothForItem.get(h.data));
        }
        for (const key of Object.keys(data)) {
          const th = document.createElement('th');
          th.textContent = key;
          heading.appendChild(th);
        }
        for (let i = 0; i < this.hoverItems.length; i++) {
          const tr = document.createElement('tr');
          table.appendChild(tr);
          for (const values of Object.values(data)) {
            const td = document.createElement('td');
            td.textContent = formatNumber(values[i]);
            tr.appendChild(td);
          }
        }
        lastTooltip = showTooltip({
          x: rect.left + this.dataRect.left + this.dataRect.width / 10,
          y: rect.top + this.dataRect.top + this.dataRect.height / 10,
        }, table);
        this.scheduleDraw();
        return;
      }
      if (this.selectionRect) {
        clearFocusedPoint();
        this.selectionRect.x2 = event.offsetX;
        this.selectionRect.y2 = event.offsetY;
        this.scheduleDraw();
        return;
      }
      clearFocusedPoint();
      this.userBounds = {
        x: this.bounds.x.map(x => this.getXPoint(x) - event.movementX).map(x => this.xToValue(x)) as [number, number],
        y: this.bounds.y.map(y => this.getYPoint(y) - event.movementY).map(y => this.yToValue(y)) as [number, number]
      }
      autofitCheckbox.checked = false;
      this.dataOrBoundsChanged();
    });


    const xLogCheckbox = makeIconCheckbox('xLog');
    xLogCheckbox.checked = this.xLog;
    xLogCheckbox.title = 'Logarithmic X axis';
    xLogCheckbox.onchange = () => {
      this.xLog = xLogCheckbox.checked;
      if (this.userBounds)
        this.userBounds.x = [this.autoBounds.x[0], this.autoBounds.x[1]];
      this.dataOrBoundsChanged();
    }
    toolbar.appendChild(xLogCheckbox);
    const yLogCheckbox = makeIconCheckbox('yLog');
    yLogCheckbox.checked = this.yLog;
    yLogCheckbox.title = 'Logarithmic Y axis';
    yLogCheckbox.onchange = () => {
      this.yLog = yLogCheckbox.checked;
      if (this.userBounds)
        this.userBounds.y = [this.autoBounds.y[0], this.autoBounds.y[1]];
      this.dataOrBoundsChanged();
    }
    toolbar.appendChild(yLogCheckbox);

    const autofitCheckbox = makeIconCheckbox('overscan');
    autofitCheckbox.checked = !this.userBounds;
    autofitCheckbox.title = 'Fit viewport to data';
    autofitCheckbox.onchange = () => {
      if (!this.userBounds === autofitCheckbox.checked)
        return;
      if (!autofitCheckbox.checked) {
        this.userBounds = {
          x: [this.autoBounds.x[0], this.autoBounds.x[1]],
          y: [this.autoBounds.y[0], this.autoBounds.y[1]]
        };
      } else {
        delete this.userBounds;
        this.dataOrBoundsChanged();
      }
    }
    toolbar.appendChild(autofitCheckbox);
    const selectRectCheckbox = makeIconCheckbox('selection-drag');
    selectRectCheckbox.checked = false;
    selectRectCheckbox.title = 'Select viewport region.';
    selectRectCheckbox.onchange = () => {
      if (selectRectCheckbox.checked)
        this.canvas.style.cursor = 'crosshair';
      else
        this.canvas.style.removeProperty('cursor');
      delete this.selectionRect;
      clearFocusedPoint();
    };
    toolbar.appendChild(selectRectCheckbox);

    this.dataLayer = new Layer(this.dataRect.width * window.devicePixelRatio, this.dataRect.height * window.devicePixelRatio, ctx => {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.save();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.translate(-this.dataRect.left, -this.dataRect.top);
      for (const line of this.lines) {
        if (this.smooth > 0)
          ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = 1;
        efficientlyDrawPoints(line, item => ({
          x: this.getXPoint(item.step),
          y: this.getYPoint(item.value),
        }));
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (this.smooth > 0) {
          ctx.beginPath();
          let value = 0;
          let count = 0;
          const smooth = 1 - ((1 - this.smooth) ** 4);
          efficientlyDrawPoints(line, item => {
            if (count < 1 / (1 - smooth))
              value = value * count / (count + 1) + item.value / (count + 1);
            value = smooth * value + (1 - smooth) * item.value;
            count++;
            this.smoothForItem.set(item, value);
            return {
              x: this.getXPoint(item.step),
              y: this.getYPoint(value),
            }
          });

          ctx.stroke();
        }
      }
      ctx.restore();
      function efficientlyDrawPoints(line: Line, transform: (item: ProcessedData[0]) => {x: number, y: number}) {
        let lastX = -Infinity;
        const points = [];
        const threshold = 0.5 / window.devicePixelRatio;
        let highestPoint = { x: -Infinity, y: -Infinity };
        let lowestPoint = { x: Infinity, y: Infinity };
        for (const item of line.data) {
          const point = transform(item);
          if (point.x - lastX > threshold) {
            flush();
            lastX = point.x;
          }
          if (point.y > highestPoint.y)
            highestPoint = point;
          if (point.y < lowestPoint.y)
            lowestPoint = point;
        }
        flush();
        function flush() {
          if (highestPoint === lowestPoint) {
            points.push(highestPoint);
          } else if (highestPoint.x > lowestPoint.x) {
            points.push(lowestPoint);
            points.push(highestPoint);
          } else {
            points.push(highestPoint);
            points.push(lowestPoint);
          }
          highestPoint = { x: -Infinity, y: -Infinity };
          lowestPoint = { x: Infinity, y: Infinity };
        }
        ctx.moveTo(points[0].x, points[0].y);
        for (const point of points.slice(1))
          ctx.lineTo(point.x, point.y);
    
      }
    });
  }

  serializeForTest() {
    return this.autoBounds;
  }

  addLine(line: Line) {
    this.lines.add(line);
    line.addListener(item => {
      this.autoBounds.x[0] = Math.min(this.autoBounds.x[0], item.step);
      this.autoBounds.x[1] = Math.max(this.autoBounds.x[1], item.step);

      this.autoBounds.y[0] = Math.min(this.autoBounds.y[0], item.value);
      this.autoBounds.y[1] = Math.max(this.autoBounds.y[1], item.value);
      this.dataOrBoundsChanged();
    });
    this.dataOrBoundsChanged();
  }

  private dataOrBoundsChanged() {
    this.dataLayer.invalidate();
    this.scheduleDraw();
  }
  private xAxisValues() {
    return this.makeIncrement(this.bounds.x[0], this.bounds.x[1], 12);
  }
  private yAxisValues() {
    return this.makeIncrement(this.bounds.y[0], this.bounds.y[1], 12);
  }
  private makeIncrement(from: number, to: number, steps: number) {
    const log = Math.log10((to - from) / steps);
    let increment = 10 ** Math.ceil(log);
    if ((to - from) / increment < steps / 2) {
      increment /= 2;
    }
    const values = [];
    for (let i = 0; (Math.ceil(from / increment) + i) * increment < to; i++)
      values.push((Math.ceil(from / increment) + i) * increment);
    return values;
  }

  scheduleDraw() {
    if (this.scheduledDraw)
      return;
    this.scheduledDraw = true;
    requestAnimationFrame(() => {
      this.scheduledDraw = false;
      this.draw();
    });
  }

  draw() {

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // this.ctx.fillStyle = background;
    // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    this.ctx.font = '10px monaco';

    // x axis
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = majorAxisColor;
    this.ctx.beginPath();
    this.ctx.moveTo(this.dataRect.left, this.dataRect.top + this.dataRect.height);
    this.ctx.lineTo(this.dataRect.left + this.dataRect.width, this.dataRect.top + this.dataRect.height);
    this.ctx.stroke();
    let lastRightEdge = -Infinity;
    for (const value of this.xAxisValues()) {
      this.ctx.fillStyle = textColor;
      const text = formatNumber(value);
      const textWidth = this.ctx.measureText(text).width;
      const x = this.getXPoint(value);
      const pixelAlignedX = (Math.floor(x*window.devicePixelRatio) + 0.5)/window.devicePixelRatio;
      if (x - textWidth / 2 > lastRightEdge + 2 && x + textWidth / 2 < this.dataRect.left + this.dataRect.width) {
        this.ctx.fillText(text, x - textWidth/2, this.dataRect.top + this.dataRect.height + (5 + this.margin) / 2);
        this.ctx.strokeStyle = majorAxisColor;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(pixelAlignedX, this.dataRect.top + this.dataRect.height);
        this.ctx.lineTo(pixelAlignedX, this.dataRect.top + this.dataRect.height + 4);
        this.ctx.stroke();
        lastRightEdge = x + textWidth/2;
      }

      this.ctx.strokeStyle = value === 0 ? zeroAxisScolor : minorAxisColor;
      this.ctx.lineWidth = value === 0 ? 1 : 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(pixelAlignedX, this.dataRect.top);
      this.ctx.lineTo(pixelAlignedX, this.dataRect.top + this.dataRect.height);
      this.ctx.stroke();
    }

    // y axis
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = majorAxisColor;
    this.ctx.beginPath();
    this.ctx.moveTo(this.dataRect.left, this.dataRect.top);
    this.ctx.lineTo(this.dataRect.left, this.dataRect.top + this.dataRect.height);
    this.ctx.stroke();
    let lastBottom = Infinity;
    for (const value of this.yAxisValues()) {
      this.ctx.fillStyle = textColor;
      const text = formatNumber(value);
      const textWidth = this.ctx.measureText(text).width;
      const y = this.getYPoint(value);
      const pixelAlignedY = (Math.floor(y*window.devicePixelRatio) + 0.5)/window.devicePixelRatio;
      if (y + 10 < lastBottom && y + 3 > 10) {
        this.ctx.fillText(text, (this.dataRect.left - textWidth) / 2, y + 3.5);
        lastBottom = y;
        this.ctx.strokeStyle = majorAxisColor;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(this.dataRect.left - 4, pixelAlignedY);
        this.ctx.lineTo(this.dataRect.left, pixelAlignedY);
        this.ctx.stroke();
          
      }
      this.ctx.strokeStyle = value === 0 ? zeroAxisScolor : minorAxisColor;
      this.ctx.lineWidth = value === 0 ? 1 : 0.5;
      this.ctx.beginPath();
      this.ctx.moveTo(this.dataRect.left, pixelAlignedY);
      this.ctx.lineTo(this.dataRect.left + this.dataRect.width, pixelAlignedY);
      this.ctx.stroke();
  
    }
    this.ctx.drawImage(this.dataLayer.get(), this.dataRect.left, this.dataRect.top, this.dataRect.width, this.dataRect.height);

    for (const item of this.hoverItems || []) {
      this.ctx.beginPath();
      this.ctx.arc(
        this.getXPoint(item.data.step),
        this.getYPoint(this.smooth ? this.smoothForItem.get(item.data) : item.data.value),
        5,
        0,
        2 * Math.PI);
      this.ctx.fillStyle = item.line.color;
      this.ctx.fill();
      this.ctx.strokeStyle = background;
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }

    if (this.selectionRect) {
      this.ctx.beginPath();
      const x = Math.min(this.selectionRect.x, this.selectionRect.x2);
      const y = Math.min(this.selectionRect.y, this.selectionRect.y2);
      const w = Math.abs(this.selectionRect.x - this.selectionRect.x2);
      const h = Math.abs(this.selectionRect.y - this.selectionRect.y2);
      this.ctx.rect(
        x,
        y,
        w,
        h
      );
      this.ctx.fillStyle = selectionInnerColor;
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = selectionBorderColor;
      this.ctx.fill();
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private get bounds() {
    return this.userBounds ? this.userBounds : this.autoBounds;
  }

  private xToValue(a: number) {
    const offset = this.autoBounds.x[0] + this.autoBounds.x[1]/100;
    const log = this.xLog;
    const x = (a - this.dataRect.left)/this.dataRect.width;
    if (log) {
      return Math.E ** (x * (Math.log(this.bounds.x[1] + offset) - Math.log(this.bounds.x[0] + offset)) + Math.log(this.bounds.x[0] + offset)) - offset;
    } else {
      return x * (this.bounds.x[1] - this.bounds.x[0]) + this.bounds.x[0];
    }
  }

  private yToValue(a: number) {
    const offset = this.autoBounds.y[0] + this.autoBounds.y[1]/100;
    const log = this.yLog;
    const y =  (1 - (a - this.dataRect.top) / this.dataRect.height);
    if (log) {
      return Math.E ** (y * (Math.log(this.bounds.y[1] + offset) - Math.log(this.bounds.y[0] + offset)) + Math.log(this.bounds.y[0] + offset)) - offset;
    } else {
      return y * (this.bounds.y[1] - this.bounds.y[0]) + this.bounds.y[0];
    }

  }

  private getXPoint(value: number) {
    const offset = this.autoBounds.x[0] + this.autoBounds.x[1]/100;
    const log = this.xLog;
    const x = log ?
      (Math.log(value + offset) - Math.log(this.bounds.x[0] + offset)) / (Math.log(this.bounds.x[1] + offset) - Math.log(this.bounds.x[0] + offset)) :
      (value - this.bounds.x[0]) / (this.bounds.x[1] - this.bounds.x[0]);
    return this.dataRect.left + x * this.dataRect.width;
  }

  private getYPoint(value: number) {
    const offset = this.autoBounds.y[0] + this.autoBounds.y[1]/100;
    const log = this.yLog;
    const y = log ?
      (Math.log(value + offset) - Math.log(this.bounds.y[0] + offset)) / (Math.log(this.bounds.y[1] + offset) - Math.log(this.bounds.y[0] + offset)) :
      (value - this.bounds.y[0]) / (this.bounds.y[1] - this.bounds.y[0]);
    return this.dataRect.top + (1 - y) * this.dataRect.height;
  }

  private resized() {
    const rect = this.canvasContainer.getBoundingClientRect()
    if (rect.width * window.devicePixelRatio === this.canvas.width && rect.height * window.devicePixelRatio === this.canvas.height)
      return;
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.dataRect = {
      top: 0,
      left: this.margin,
      width: this.canvas.width / window.devicePixelRatio - this.margin,
      height: this.canvas.height / window.devicePixelRatio - this.margin,
    };
    this.draw();
    this.eventually.run(() => {
      this.dataLayer.resize(this.dataRect.width * window.devicePixelRatio, this.dataRect.height * window.devicePixelRatio);
      this.scheduleDraw();
    }, 100);
  }
}

function formatNumber(x: number): string {
  if (x === 0) {
    return '0';
  }
  return x.toLocaleString(undefined, { notation: Math.abs(x) < .01 ? 'scientific' : 'compact' });
}
