/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { FILL_CHAR_DATA } from './Buffer';
import { BufferLine } from './BufferLine';
import { CircularList, IDeleteEvent } from './common/CircularList';
import { IBufferLine } from './Types';

export interface INewLayoutResult {
  layout: number[];
  countRemoved: number;
}

/**
 * Evaluates and returns indexes to be removed after a reflow larger occurs. Lines will be removed
 * when a wrapped line unwraps.
 * @param lines The buffer lines.
 * @param newCols The columns after resize.
 */
export function reflowLargerGetLinesToRemove(lines: CircularList<IBufferLine>, newCols: number, bufferAbsoluteY: number): number[] {
  // Gather all BufferLines that need to be removed from the Buffer here so that they can be
  // batched up and only committed once
  const toRemove: number[] = [];

  for (let y = 0; y < lines.length - 1; y++) {
    // Check if this row is wrapped
    let i = y;
    let nextLine = lines.get(++i) as BufferLine;
    if (!nextLine.isWrapped) {
      continue;
    }

    // Check how many lines it's wrapped for
    const wrappedLines: BufferLine[] = [lines.get(y) as BufferLine];
    while (i < lines.length && nextLine.isWrapped) {
      wrappedLines.push(nextLine);
      nextLine = lines.get(++i) as BufferLine;
    }

    // If these lines contain the cursor don't touch them, the program will handle fixing up wrapped
    // lines with the cursor
    if (bufferAbsoluteY >= y && bufferAbsoluteY < i) {
      y += wrappedLines.length - 1;
      continue;
    }

    // Copy buffer data to new locations
    let destLineIndex = 0;
    let destCol = wrappedLines[destLineIndex].getTrimmedLength();
    let srcLineIndex = 1;
    let srcCol = 0;
    while (srcLineIndex < wrappedLines.length) {
      const srcTrimmedTineLength = wrappedLines[srcLineIndex].getTrimmedLength();
      const srcRemainingCells = srcTrimmedTineLength - srcCol;
      const destRemainingCells = newCols - destCol;
      const cellsToCopy = Math.min(srcRemainingCells, destRemainingCells);

      wrappedLines[destLineIndex].copyCellsFrom(wrappedLines[srcLineIndex], srcCol, destCol, cellsToCopy, false);

      destCol += cellsToCopy;
      if (destCol === newCols) {
        destLineIndex++;
        destCol = 0;
      }
      srcCol += cellsToCopy;
      if (srcCol === srcTrimmedTineLength) {
        srcLineIndex++;
        srcCol = 0;
      }

      // Make sure the last cell isn't wide, if it is copy it to the current dest
      if (destCol === 0 && destLineIndex !== 0) {
        if (wrappedLines[destLineIndex - 1].getWidth(newCols - 1) === 2) {
          wrappedLines[destLineIndex].copyCellsFrom(wrappedLines[destLineIndex - 1], newCols - 1, destCol++, 1, false);
          // Null out the end of the last row
          wrappedLines[destLineIndex - 1].set(newCols - 1, FILL_CHAR_DATA);
        }
      }
    }

    // Clear out remaining cells or fragments could remain;
    wrappedLines[destLineIndex].replaceCells(destCol, newCols, FILL_CHAR_DATA);

    // Work backwards and remove any rows at the end that only contain null cells
    let countToRemove = 0;
    for (let i = wrappedLines.length - 1; i > 0; i--) {
      if (i > destLineIndex || wrappedLines[i].getTrimmedLength() === 0) {
        countToRemove++;
      } else {
        break;
      }
    }

    if (countToRemove > 0) {
      toRemove.push(y + wrappedLines.length - countToRemove); // index
      toRemove.push(countToRemove);
    }

    y += wrappedLines.length - 1;
  }
  return toRemove;
}

/**
 * Creates and return the new layout for lines given an array of indexes to be removed.
 * @param lines The buffer lines.
 * @param toRemove The indexes to remove.
 */
export function reflowLargerCreateNewLayout(lines: CircularList<IBufferLine>, toRemove: number[]): INewLayoutResult {
  const layout: number[] = [];
  // First iterate through the list and get the actual indexes to use for rows
  let nextToRemoveIndex = 0;
  let nextToRemoveStart = toRemove[nextToRemoveIndex];
  let countRemovedSoFar = 0;
  for (let i = 0; i < lines.length; i++) {
    if (nextToRemoveStart === i) {
      const countToRemove = toRemove[++nextToRemoveIndex];

      // Tell markers that there was a deletion
      lines.emit('delete', {
        index: i - countRemovedSoFar,
        amount: countToRemove
      } as IDeleteEvent);

      i += countToRemove - 1;
      countRemovedSoFar += countToRemove;
      nextToRemoveStart = toRemove[++nextToRemoveIndex];
    } else {
      layout.push(i);
    }
  }
  return {
    layout,
    countRemoved: countRemovedSoFar
  };
}

/**
 * Applies a new layout to the buffer. This essentially does the same as many splice calls but it's
 * done all at once in a single iteration through the list since splice is very expensive.
 * @param lines The buffer lines.
 * @param newLayout The new layout to apply.
 */
export function reflowLargerApplyNewLayout(lines: CircularList<IBufferLine>, newLayout: number[]): void {
  // Record original lines so they don't get overridden when we rearrange the list
  const newLayoutLines: BufferLine[] = [];
  for (let i = 0; i < newLayout.length; i++) {
    newLayoutLines.push(lines.get(newLayout[i]) as BufferLine);
  }

  // Rearrange the list
  for (let i = 0; i < newLayoutLines.length; i++) {
    lines.set(i, newLayoutLines[i]);
  }
  lines.length = newLayout.length;
}

/**
 * Gets the new line lengths for a given wrapped line. The purpose of this function it to pre-
 * compute the wrapping points since wide characters may need to be wrapped onto the following line.
 * This function will return an array of numbers of where each line wraps to, the resulting array
 * will only contain the values `newCols` (when the line does not end with a wide character) and
 * `newCols - 1` (when the line does end with a wide character), except for the last value which
 * will contain the remaining items to fill the line.
 *
 * Calling this with a `newCols` value of `1` will lock up.
 *
 * @param wrappedLines The wrapped lines to evaluate.
 * @param oldCols The columns before resize.
 * @param newCols The columns after resize.
 */
export function reflowSmallerGetNewLineLengths(wrappedLines: BufferLine[], oldCols: number, newCols: number): number[] {
  const newLineLengths: number[] = [];
  const cellsNeeded = wrappedLines.map(l => l.getTrimmedLength()).reduce((p, c) => p + c);

  // Use srcCol and srcLine to find the new wrapping point, use that to get the cellsAvailable and
  // linesNeeded
  let srcCol = 0;
  let srcLine = 0;
  let cellsAvailable = 0;
  while (cellsAvailable < cellsNeeded) {
    if (cellsNeeded - cellsAvailable < newCols) {
      // Add the final line and exit the loop
      newLineLengths.push(cellsNeeded - cellsAvailable);
      break;
    }
    srcCol += newCols;
    const oldTrimmedLength = wrappedLines[srcLine].getTrimmedLength();
    if (srcCol > oldTrimmedLength) {
      srcCol -= oldTrimmedLength;
      srcLine++;
    }
    const endsWithWide = wrappedLines[srcLine].getWidth(srcCol - 1) === 2;
    if (endsWithWide) {
      srcCol--;
    }
    const lineLength = endsWithWide ? newCols - 1 : newCols;
    newLineLengths.push(lineLength);
    cellsAvailable += lineLength;
  }

  return newLineLengths;
}
