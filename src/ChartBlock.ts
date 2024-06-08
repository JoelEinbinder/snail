import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
import type { FindParams } from "./Find";
import type { LogItem } from "./LogItem";
import type { Action } from "./actions";
import { Chart, Line } from './charts/Chart';
import './chartBlock.css';
export class ChartBlock implements LogItem {
  willResizeEvent = new JoelEvent<void>(undefined);
  element = document.createElement('div');
  private _charts = new Map<string, Chart>();
  private _lines = new Map<string, Line>();
  private _nextStep = 0;
  constructor() {
    this.element.classList.add('chart-block');
  }
  render() {
    return this.element;
  }
  focus() {
  }
  dispose(): void {
  }
  async serializeForTest(): Promise<any> {
    const serialized = {};
    for (const [name, chart] of this._charts)
      serialized[name] = chart.serializeForTest();
    return serialized;
  }
  isFullscreen(): boolean {
    return false;
  }
  async aysncActions(): Promise<Action[]> {
    return [];
  }
  setFind(params: FindParams): void {
  }

  appendUserData(data: any) {
    const normalized = normalizeData(data);
    if (!normalized)
      return;
    const { data: chartData, step = this._nextStep, wallTime = Date.now() } = normalized;
    this._nextStep = step + 1;
    for (const name in chartData) {
      const chart = this._getOrCreateChart(name);
      this._lines.get(name).appendData([ { step, value: chartData[name], wallTime } ]);
    }
  }

  _getOrCreateChart(name: string) {
    if (!this._charts.has(name)) {
      const chart = new Chart({
        title: name,
        allowNormalScrolling: true,
      });
      this._charts.set(name, chart);
      const line = new Line({ color: Line.colorForIndex(0) });
      chart.addLine(line);
      this._lines.set(name, line);
      this.element.appendChild(chart.element);
      this.willResizeEvent.dispatch();
    }
    return this._charts.get(name)!;
  }
}

function normalizeData(data: any): { data: {[key: string]: number}, step?: number, wallTime?: number } | null {
  if (typeof data === 'number')
    return { data: { value: data } };
  if (typeof data === 'object') {
    const { step, wallTime } = data;
    data = {...data};
    delete data.step;
    delete data.step;
    for (const key in data) {
      if (typeof data[key] !== 'number') {
        console.error('Unexpected chart data', data);
        return null;
      }
    }
    if (!Object.keys(data).length)
      return null;
    return { data, step, wallTime };
  }
  console.error('Unexpected chart data', data);
  return null;
}