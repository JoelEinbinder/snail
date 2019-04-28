/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IDisposable } from 'xterm';

/**
 * Debounces calls to render terminal rows using animation frames.
 */
export class RenderDebouncer implements IDisposable {
  private _rowStart: number;
  private _rowEnd: number;
  private _rowCount: number;
  private _animationFrame: number = null;

  constructor(
    private _callback: (start: number, end: number) => void
  ) {
  }

  public dispose(): void {
    if (this._animationFrame) {
      window.cancelAnimationFrame(this._animationFrame);
      this._animationFrame = null;
    }
  }

  public refresh(rowStart: number, rowEnd: number, rowCount: number): void {
    this._rowCount = rowCount;
    // Get the min/max row start/end for the arg values
    rowStart = rowStart !== null && rowStart !== undefined ? rowStart : 0;
    rowEnd = rowEnd !== null && rowEnd !== undefined ? rowEnd : this._rowCount - 1;
    // Check whether the row start/end values have already been set
    const isRowStartSet = this._rowStart !== undefined && this._rowStart !== null;
    const isRowEndSet = this._rowEnd !== undefined && this._rowEnd !== null;
    // Set the properties to the updated values
    this._rowStart = isRowStartSet ? Math.min(this._rowStart, rowStart) : rowStart;
    this._rowEnd = isRowEndSet ? Math.max(this._rowEnd, rowEnd) : rowEnd;

    if (this._animationFrame) {
      return;
    }

    this._animationFrame = window.requestAnimationFrame(() => this._innerRefresh());
  }

  private _innerRefresh(): void {
    // Clamp values
    this._rowStart = Math.max(this._rowStart, 0);
    this._rowEnd = Math.min(this._rowEnd, this._rowCount - 1);

    // Run render callback
    this._callback(this._rowStart, this._rowEnd);

    // Reset debouncer
    this._rowStart = null;
    this._rowEnd = null;
    this._animationFrame = null;
  }
}
