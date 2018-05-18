/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal } from '../Types';
import { IEventEmitter, ITheme } from 'xterm';
import { IColorSet } from '../shared/Types';

/**
 * Flags used to render terminal text properly.
 */
export const enum FLAGS {
  BOLD = 1,
  UNDERLINE = 2,
  BLINK = 4,
  INVERSE = 8,
  INVISIBLE = 16,
  DIM = 32,
  ITALIC = 64
}

export interface IRenderer extends IEventEmitter {
  dimensions: IRenderDimensions;
  colorManager: IColorManager;

  setTheme(theme: ITheme): IColorSet;
  onWindowResize(devicePixelRatio: number): void;
  onResize(cols: number, rows: number): void;
  onCharSizeChanged(): void;
  onBlur(): void;
  onFocus(): void;
  onSelectionChanged(start: [number, number], end: [number, number]): void;
  onCursorMove(): void;
  onOptionsChanged(): void;
  clear(): void;
  refreshRows(start: number, end: number): void;
}

export interface IColorManager {
  colors: IColorSet;
}

// TODO: We should probably rewrite the imports for IColorSet, but there's a lot of them
export { IColorSet };

export interface IRenderDimensions {
  scaledCharWidth: number;
  scaledCharHeight: number;
  scaledCellWidth: number;
  scaledCellHeight: number;
  scaledCharLeft: number;
  scaledCharTop: number;
  scaledCanvasWidth: number;
  scaledCanvasHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  actualCellWidth: number;
  actualCellHeight: number;
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
  resize(terminal: ITerminal, dim: IRenderDimensions): void;

  /**
   * Clear the state of the render layer.
   */
  reset(terminal: ITerminal): void;
}
