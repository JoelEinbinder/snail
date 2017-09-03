import { ITerminal, ITerminalOptions, ITheme } from '../Interfaces';

export interface IRenderer {
  setTheme(theme: ITheme): IColorSet;
  onResize(cols: number, rows: number): void;
  onCharSizeChanged(charWidth: number, charHeight: number): void;
  onBlur(): void;
  onFocus(): void;
  onSelectionChanged(start: [number, number], end: [number, number]): void;
  onCursorMove(): void;
  onOptionsChanged(): void;
  clear(): void;
  queueRefresh(start: number, end: number): void;
}

export interface IRenderLayer {
  /**
   * Called when the terminal loses focus.
   */
  onBlur(terminal: ITerminal): void;

  /**
   * * Called when the terminal gets focus.
   */
  onFocus(terminal: ITerminal): void;

  /**
   * Called when the cursor is moved.
   */
  onCursorMove(terminal: ITerminal): void;

  /**
   * Called when options change.
   */
  onOptionsChanged(terminal: ITerminal): void;

  /**
   * Called when the theme changes.
   */
  onThemeChanged(terminal: ITerminal, colorSet: IColorSet): void;

  /**
   * Called when the data in the grid has changed (or needs to be rendered
   * again).
   */
  onGridChanged(terminal: ITerminal, startRow: number, endRow: number): void;

  /**
   * Calls when the selection changes.
   */
  onSelectionChanged(terminal: ITerminal, start: [number, number], end: [number, number]): void;

  /**
   * Resize the render layer.
   */
  resize(terminal: ITerminal, canvasWidth: number, canvasHeight: number, charSizeChanged: boolean): void;

  /**
   * Clear the state of the render layer.
   */
  reset(terminal: ITerminal): void;
}


export interface IColorSet {
  foreground: string;
  background: string;
  cursor: string;
  ansi: string[];
}
