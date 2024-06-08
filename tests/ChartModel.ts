import type { JSHandle, Page } from '@playwright/test';
import type { Chart, Line } from '../src/charts/Chart';
export class ChartModel {
  private constructor(
    public readonly page: Page,
    private _editor: JSHandle<Chart>,
    private _line: JSHandle<Line>,
    ) {
  }
  static async create(page: Page) {
    const handle = await page.evaluateHandle<Chart>(() => window['chart']);
    const line = await page.evaluateHandle<Line>(() => window['line']);
    const chartModel = new ChartModel(page, handle, line);
    return chartModel;
  }

  get editor() {
    return this._editor;
  }

  get line() {
    return this._line;
  }
}
