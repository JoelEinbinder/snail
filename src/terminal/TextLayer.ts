import type { IOptionsService, IBufferService } from 'xterm/src/common/services/Services';
import type { ICellData } from 'xterm/src/common/Types';
import { AttributeData } from 'xterm/src/common/buffer/AttributeData';
import { NULL_CELL_CODE, Content } from 'xterm/src/common/buffer/Constants';
import type { IColorSet, IColor } from 'xterm/src/browser/Types';
import { CellData } from 'xterm/src/common/buffer/CellData';
import { ICharacterJoinerService } from 'xterm/src/browser/services/Services';
import { JoinedCellData } from 'xterm/src/browser/services/CharacterJoinerService';
import type { IRenderDimensions } from 'xterm/src/browser/renderer/Types';
import { DIM_OPACITY, INVERTED_DEFAULT_COLOR, TEXT_BASELINE } from 'xterm/src/browser/renderer/atlas/Constants';
import { channels, color, rgba } from 'xterm/src/browser/Color';

export function makeTextDrawer(
  bufferService: IBufferService,
  characterJoinerService: ICharacterJoinerService,
  colors: IColorSet,
  optionsService: IOptionsService,
  getSelection: () => ({ start: [number, number], end: [number, number], columnSelectMode: boolean } | undefined),
  dimensions: IRenderDimensions,
  getScrollOffset: () => number,
  ) {
  let ctx: CanvasRenderingContext2D;
  const workCell = new CellData();
  const characterWidth: number = 0;
  const characterFont: string = '';
  const characterOverlapCache: { [key: string]: boolean } = {};
  const alpha = true;
  
  function forEachCell(
    firstRow: number,
    lastRow: number,
    callback: (
      cell: ICellData,
      x: number,
      y: number
    ) => void
  ): void {
    for (let y = firstRow; y <= lastRow; y++) {
      const row = y;
      const line = bufferService.buffer.lines.get(row);
      if (!line)
        continue;
      const joinedRanges = characterJoinerService.getJoinedCharacters(row);
      for (let x = 0; x < bufferService.cols; x++) {
        line!.loadCell(x, workCell);
        let cell = workCell;

        // If true, indicates that the current character(s) to draw were joined.
        let isJoined = false;
        let lastCharX = x;

        // The character to the left is a wide character, drawing is owned by
        // the char at x-1
        if (cell.getWidth() === 0) {
          continue;
        }

        // Process any joined character ranges as needed. Because of how the
        // ranges are produced, we know that they are valid for the characters
        // and attributes of our input.
        if (joinedRanges.length > 0 && x === joinedRanges[0][0]) {
          isJoined = true;
          const range = joinedRanges.shift()!;

          // We already know the exact start and end column of the joined range,
          // so we get the string and width representing it directly
          cell = new JoinedCellData(
            workCell,
            line!.translateToString(true, range[0], range[1]),
            range[1] - range[0]
          );

          // Skip over the cells occupied by this range in the loop
          lastCharX = range[1] - 1;
        }

        // If the character is an overlapping char and the character to the
        // right is a space, take ownership of the cell to the right. We skip
        // this check for joined characters because their rendering likely won't
        // yield the same result as rendering the last character individually.
        if (!isJoined && isOverlapping(cell)) {
          // If the character is overlapping, we want to force a re-render on every
          // frame. This is specifically to work around the case where two
          // overlaping chars `a` and `b` are adjacent, the cursor is moved to b and a
          // space is added. Without this, the first half of `b` would never
          // get removed, and `a` would not re-render because it thinks it's
          // already in the correct state.
          // state.cache[x][y] = OVERLAP_OWNED_CHAR_DATA;
          if (lastCharX < line!.length - 1 && line!.getCodePoint(lastCharX + 1) === NULL_CELL_CODE) {
            // patch width to 2
            cell.content &= ~Content.WIDTH_MASK;
            cell.content |= 2 << Content.WIDTH_SHIFT;
            // clearChar(x + 1, y);
            // The overlapping char's char data will force a clear and render when the
            // overlapping char is no longer to the left of the character and also when
            // the space changes to another character.
            // state.cache[x + 1][y] = OVERLAP_OWNED_CHAR_DATA;
          }
        }

        callback(
          cell,
          x,
          y
        );

        x = lastCharX;
      }
    }
  }

  /**
   * Draws the background for a specified range of columns. Tries to batch adjacent cells of the
   * same color together to reduce draw calls.
   */
  function drawBackground(firstRow: number, lastRow: number): void {
    const cols = bufferService.cols;
    let startX: number = 0;
    let startY: number = 0;
    let prevFillStyle: string | null = null;

    ctx.save();

    forEachCell(firstRow, lastRow, (cell, x, y) => {
      // libvte and xterm both draw the background (but not foreground) of invisible characters,
      // so we should too.
      let nextFillStyle = null; // null represents default background color

      if (cell.isInverse()) {
        if (cell.isFgDefault()) {
          nextFillStyle = colors.foreground.css;
        } else if (cell.isFgRGB()) {
          nextFillStyle = `rgb(${AttributeData.toColorRGB(cell.getFgColor()).join(',')})`;
        } else {
          nextFillStyle = colors.ansi[cell.getFgColor()].css;
        }
      } else if (cell.isBgRGB()) {
        nextFillStyle = `rgb(${AttributeData.toColorRGB(cell.getBgColor()).join(',')})`;
      } else if (cell.isBgPalette()) {
        nextFillStyle = colors.ansi[cell.getBgColor()].css;
      }

      if (prevFillStyle === null) {
        // This is either the first iteration, or the default background was set. Either way, we
        // don't need to draw anything.
        startX = x;
        startY = y;
      }

      if (y !== startY) {
        // our row changed, draw the previous row
        ctx.fillStyle = prevFillStyle || '';
        fillCells(startX, startY, cols - startX, 1);
        startX = x;
        startY = y;
      } else if (prevFillStyle !== nextFillStyle) {
        // our color changed, draw the previous characters in this row
        ctx.fillStyle = prevFillStyle || '';
        fillCells(startX, startY, x - startX, 1);
        startX = x;
        startY = y;
      }

      prevFillStyle = nextFillStyle;
    });

    // flush the last color we encountered
    if (prevFillStyle !== null) {
      ctx.fillStyle = prevFillStyle;
      fillCells(startX, startY, cols - startX, 1);
    }

    ctx.restore();
  }

  function drawForeground(firstRow: number, lastRow: number): void {
    forEachCell(firstRow, lastRow, (cell, x, y) => {
      if (cell.isInvisible()) {
        return;
      }
      drawChars(cell, x, y);
      if (cell.isUnderline() || cell.isStrikethrough()) {
        ctx.save();

        if (cell.isInverse()) {
          if (cell.isBgDefault()) {
            ctx.fillStyle = colors.background.css;
          } else if (cell.isBgRGB()) {
            ctx.fillStyle = `rgb(${AttributeData.toColorRGB(cell.getBgColor()).join(',')})`;
          } else {
            let bg = cell.getBgColor();
            if (optionsService.options.drawBoldTextInBrightColors && cell.isBold() && bg < 8) {
              bg += 8;
            }
            ctx.fillStyle = colors.ansi[bg].css;
          }
        } else {
          if (cell.isFgDefault()) {
            ctx.fillStyle = colors.foreground.css;
          } else if (cell.isFgRGB()) {
            ctx.fillStyle = `rgb(${AttributeData.toColorRGB(cell.getFgColor()).join(',')})`;
          } else {
            let fg = cell.getFgColor();
            if (optionsService.options.drawBoldTextInBrightColors && cell.isBold() && fg < 8) {
              fg += 8;
            }
            ctx.fillStyle = colors.ansi[fg].css;
          }
        }

        if (cell.isStrikethrough()) {
          fillMiddleLineAtCells(x, y, cell.getWidth());
        }
        if (cell.isUnderline()) {
          fillBottomLineAtCells(x, y, cell.getWidth());
        }
        ctx.restore();
      }
    });
  }

  /**
   * Whether a character is overlapping to the next cell.
   */
  function isOverlapping(cell: ICellData): boolean {
    // Only single cell characters can be overlapping, rendering issues can
    // occur without this check
    if (cell.getWidth() !== 1) {
      return false;
    }

    // We assume that any ascii character will not overlap
    if (cell.getCode() < 256) {
      return false;
    }

    const chars = cell.getChars();

    // Deliver from cache if available
    if (characterOverlapCache.hasOwnProperty(chars)) {
      return characterOverlapCache[chars];
    }

    // Setup the font
    ctx.save();
    ctx.font = characterFont;

    // Measure the width of the character, but Math.floor it
    // because that is what the renderer does when it calculates
    // the character dimensions we are comparing against
    const overlaps = Math.floor(ctx.measureText(chars).width) > characterWidth;

    // Restore the original context
    ctx.restore();

    // Cache and return
    characterOverlapCache[chars] = overlaps;
    return overlaps;
  }

  /**
   * Draws one or more characters at one or more cells. The character(s) will be
   * clipped to ensure that they fit with the cell(s), including the cell to the
   * right if the last character is a wide character.
   * @param chars The character.
   * @param width The width of the character.
   * @param fg The foreground color, in the format stored within the attributes.
   * @param x The column to draw at.
   * @param y The row to draw at.
   */
  function drawChars(cell: ICellData, x: number, y: number, fgOverride?: IColor): void {
    ctx.save();
    ctx.font = getFont(!!cell.isBold(), !!cell.isItalic());
    ctx.textBaseline = TEXT_BASELINE;

    if (cell.isInverse()) {
      if (fgOverride) {
        ctx.fillStyle = fgOverride.css;
      } else if (cell.isBgDefault()) {
        ctx.fillStyle = color.opaque(colors.background).css;
      } else if (cell.isBgRGB()) {
        ctx.fillStyle = `rgb(${AttributeData.toColorRGB(cell.getBgColor()).join(',')})`;
      } else {
        let bg = cell.getBgColor();
        if (optionsService.options.drawBoldTextInBrightColors && cell.isBold() && bg < 8) {
          bg += 8;
        }
        ctx.fillStyle = colors.ansi[bg].css;
      }
    } else {
      if (fgOverride) {
        ctx.fillStyle = fgOverride.css;
      } else if (cell.isFgDefault()) {
        ctx.fillStyle = colors.foreground.css;
      } else if (cell.isFgRGB()) {
        ctx.fillStyle = `rgb(${AttributeData.toColorRGB(cell.getFgColor()).join(',')})`;
      } else {
        let fg = cell.getFgColor();
        if (optionsService.options.drawBoldTextInBrightColors && cell.isBold() && fg < 8) {
          fg += 8;
        }
        ctx.fillStyle = colors.ansi[fg].css;
      }
    }

    // clipRow(y);

    // Apply alpha to dim the character
    if (cell.isDim()) {
      ctx.globalAlpha = DIM_OPACITY;
    }

    // Draw custom characters if applicable
    let drawSuccess = false;
    // if (optionsService.options.customGlyphs !== false) {
    //   drawSuccess = tryDrawCustomChar(ctx, cell.getChars(), x * dimensions.scaledCellWidth, y * dimensions.scaledCellHeight, dimensions.scaledCellWidth, dimensions.scaledCellHeight);
    // }

    // Draw the character
    if (!drawSuccess) {
      ctx.fillText(
        cell.getChars(),
        x * dimensions.scaledCellWidth + dimensions.scaledCharLeft,
        y * dimensions.scaledCellHeight + dimensions.scaledCharTop + dimensions.scaledCharHeight);
    }

    ctx.restore();
  }
  /**
   * Fills 1+ cells completely. This uses the existing fillStyle on the context.
   * @param x The column to start at.
   * @param y The row to start at
   * @param width The number of columns to fill.
   * @param height The number of rows to fill.
   */
  function fillCells(x: number, y: number, width: number, height: number): void {
    ctx.fillRect(
      x * dimensions.scaledCellWidth,
      y * dimensions.scaledCellHeight,
      width * dimensions.scaledCellWidth,
      height * dimensions.scaledCellHeight);
  }
   /**
    * Fills a 1px line (2px on HDPI) at the middle of the cell. This uses the
    * existing fillStyle on the context.
    * @param x The column to fill.
    * @param y The row to fill.
    */
   function fillMiddleLineAtCells(x: number, y: number, width: number = 1): void {
    const cellOffset = Math.ceil(dimensions.scaledCellHeight * 0.5);
    const dpr = window.devicePixelRatio;
    ctx.fillRect(
      x * dimensions.scaledCellWidth,
      (y + 1) * dimensions.scaledCellHeight - cellOffset - dpr,
      width * dimensions.scaledCellWidth,
      dpr);
  }
  /**
   * Fills a 1px line (2px on HDPI) at the bottom of the cell. This uses the
   * existing fillStyle on the context.
   * @param x The column to fill.
   * @param y The row to fill.
   */
  function fillBottomLineAtCells(x: number, y: number, width: number = 1): void {
    const dpr = window.devicePixelRatio;
    ctx.fillRect(
      x * dimensions.scaledCellWidth,
      (y + 1) * dimensions.scaledCellHeight - dpr - 1 /* Ensure it's drawn within the cell */,
      width * dimensions.scaledCellWidth,
      dpr);
  }
 
  /**
   * Clears 1+ cells completely.
   * @param x The column to start at.
   * @param y The row to start at.
   * @param width The number of columns to clear.
   * @param height The number of rows to clear.
   */
  function clearCells(x: number, y: number, width: number, height: number): void {
    if (alpha) {
      ctx.clearRect(
        x * dimensions.scaledCellWidth,
        y * dimensions.scaledCellHeight,
        width * dimensions.scaledCellWidth,
        height * dimensions.scaledCellHeight);
    } else {
      ctx.fillStyle = colors.background.css;
      ctx.fillRect(
        x * dimensions.scaledCellWidth,
        y * dimensions.scaledCellHeight,
        width * dimensions.scaledCellWidth,
        height * dimensions.scaledCellHeight);
    }
  }

  /**
   * Gets the current font.
   * @param isBold If we should use the bold fontWeight.
   */
  function getFont(isBold: boolean, isItalic: boolean): string {
    const fontWeight = isBold ? optionsService.options.fontWeightBold : optionsService.options.fontWeight;
    const fontStyle = isItalic ? 'italic' : '';

    return `${fontStyle} ${fontWeight} ${optionsService.options.fontSize * window.devicePixelRatio}px ${optionsService.options.fontFamily}`;
  }

  function drawSelection() {
    const selection = getSelection();

    // Selection does not exist
    if (!selection)
      return;
    const {start, end, columnSelectMode} = selection;

    // Translate from buffer position to viewport position
    const viewportStartRow = start[1];
    const viewportEndRow = end[1];
    const viewportCappedStartRow = Math.max(viewportStartRow, 0);
    const viewportCappedEndRow = Math.min(viewportEndRow, bufferService.rows + bufferService.buffer.ydisp - 1);

    // No need to draw the selection
    if (viewportCappedStartRow >= bufferService.rows + bufferService.buffer.ydisp || viewportCappedEndRow < 0)
      return;

    ctx.fillStyle = colors.selectionOpaque.css;

    if (columnSelectMode) {
      const startCol = start[0];
      const width = end[0] - startCol;
      const height = viewportCappedEndRow - viewportCappedStartRow + 1;
      fillCells(startCol, viewportCappedStartRow, width, height);
    } else {
      // Draw first row
      const startCol = viewportStartRow === viewportCappedStartRow ? start[0] : 0;
      const startRowEndCol = viewportCappedStartRow === viewportEndRow ? end[0] : bufferService.cols;
      fillCells(startCol, viewportCappedStartRow, startRowEndCol - startCol, 1);

      // Draw middle rows
      const middleRowsCount = Math.max(viewportCappedEndRow - viewportCappedStartRow - 1, 0);
      fillCells(0, viewportCappedStartRow + 1, bufferService.cols, middleRowsCount);

      // Draw final row
      if (viewportCappedStartRow !== viewportCappedEndRow) {
        // Only draw viewportEndRow if it's not the same as viewportStartRow
        const endCol = viewportEndRow === viewportCappedEndRow ? end[0] : bufferService.cols;
        fillCells(0, viewportCappedEndRow, endCol, 1);
      }
    }    
  }

  return function(_ctx: CanvasRenderingContext2D, rects: Rect[]): void {
    ctx = _ctx;
    const scrollOffset = getScrollOffset();
    ctx.save();
    ctx.translate(0, -scrollOffset);
    let firstRow = 0;
    for (firstRow = 0; firstRow < bufferService.buffer.lines.length; firstRow++) {
      if (rects.some(rect => intersects({
        x: 0,
        y: firstRow * dimensions.scaledCellHeight - scrollOffset,
        width: dimensions.scaledCanvasWidth,
        height: dimensions.scaledCellHeight
      }, rect)))
        break;
    }
    let lastRow = firstRow;
    for (lastRow = firstRow; lastRow < bufferService.buffer.lines.length; lastRow++) {
      if (!rects.some(rect => intersects({
        x: 0,
        y: lastRow * dimensions.scaledCellHeight - scrollOffset,
        width: dimensions.scaledCanvasWidth,
        height: dimensions.scaledCellHeight
      }, rect)))
        break;
    }
    ctx.beginPath();
    for (const rect of rects)
      ctx.rect(rect.x, rect.y + scrollOffset, rect.width, rect.height);
    ctx.clip();
    clearCells(0, firstRow, bufferService.cols, lastRow - firstRow + 1);
    drawBackground(firstRow, lastRow);
    drawSelection();
    drawForeground(firstRow, lastRow);
    ctx.restore();
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
