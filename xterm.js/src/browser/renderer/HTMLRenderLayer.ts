import { IRenderDimensions, IRenderLayer } from 'browser/renderer/Types';
import { IColorSet } from 'browser/Types';
import { IBuffer } from 'common/buffer/Types';
import { ITerminalOptions, Terminal } from 'xterm';

export class HTMLRenderLayer implements IRenderLayer {
  private _scaledCellWidth = 0;
  private _scaledCellHeight = 0;
  private _scaledCharWidth = 0;
  private _scaledCharHeight = 0;
  private _scaledCharLeft = 0;
  private _scaledCharTop = 0;
  constructor(
    private _container: HTMLElement,
    private _colors: IColorSet,
    private _getBuffer: () => IBuffer,
    private _getOptions: () => ITerminalOptions,
    private _getRows: () => number
  ) {
  }
  public onBlur(): void { }
  public onFocus(): void { }
  public onCursorMove(): void { }
  public onOptionsChanged(): void { }

  public setColors(colorSet: IColorSet): void {
    this._colors = colorSet;
  }
  public onSelectionChanged(start: [number, number] | undefined, end: [number, number] | undefined, columnSelectMode: boolean): void { }
  public resize(dim: IRenderDimensions): void {
    this._scaledCellWidth = dim.scaledCellWidth;
    this._scaledCellHeight = dim.scaledCellHeight;
    this._scaledCharWidth = dim.scaledCharWidth;
    this._scaledCharHeight = dim.scaledCharHeight;
    this._scaledCharLeft = dim.scaledCharLeft;
    this._scaledCharTop = dim.scaledCharTop;
  }
  public dispose(): void { }

  public reset(): void {
    for (const html of this._getBuffer().htmls) {
      html.hide();
    }
  }

  public onGridChanged(startRow: number, endRow: number): void {
    const htmlFont = this._getFont(false, false);
    for (const html of this._getBuffer().htmls) {
      html.render(this._getBuffer().ydisp, this._getBuffer().ydisp + this._getRows(), this._scaledCellWidth, this._scaledCellHeight, htmlFont, this._colors, this._container);
    }
  }

  protected _getFont(isBold: boolean, isItalic: boolean): string {
    const fontWeight = isBold ? this._getOptions().fontWeightBold : this._getOptions().fontWeight;
    const fontStyle = isItalic ? 'italic' : '';

    return `${fontStyle} ${fontWeight} ${this._getOptions().fontSize}px ${this._getOptions().fontFamily}`;
  }

  public clearTextureAtlas(): void {
  }
}
