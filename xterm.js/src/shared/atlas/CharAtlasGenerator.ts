/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { FontWeight } from 'xterm';
import { CHAR_ATLAS_CELL_SPACING, ICharAtlasConfig } from './Types';
import { isFirefox } from '../utils/Browser';

declare const Promise: any;

export interface IOffscreenCanvas {
  width: number;
  height: number;
  getContext(type: '2d', config?: Canvas2DContextAttributes): CanvasRenderingContext2D;
  transferToImageBitmap(): ImageBitmap;
}

/**
 * Generates a char atlas.
 * @param context The window or worker context.
 * @param canvasFactory A function to generate a canvas with a width or height.
 * @param request The config for the new char atlas.
 */
export function generateCharAtlas(context: Window, canvasFactory: (width: number, height: number) => HTMLCanvasElement | IOffscreenCanvas, config: ICharAtlasConfig): HTMLCanvasElement | Promise<ImageBitmap> {
  const cellWidth = config.scaledCharWidth + CHAR_ATLAS_CELL_SPACING;
  const cellHeight = config.scaledCharHeight + CHAR_ATLAS_CELL_SPACING;
  const canvas = canvasFactory(
    /*255 ascii chars*/255 * cellWidth,
    (/*default+default bold*/2 + /*0-15*/16) * cellHeight
  );
  const ctx = canvas.getContext('2d', {alpha: config.allowTransparency});

  ctx.fillStyle = config.colors.background.css;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = config.colors.foreground.css;
  ctx.font = getFont(config.fontWeight, config);
  ctx.textBaseline = 'top';

  // Default color
  for (let i = 0; i < 256; i++) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * cellWidth, 0, cellWidth, cellHeight);
    ctx.clip();
    ctx.fillText(String.fromCharCode(i), i * cellWidth, 0);
    ctx.restore();
  }
  // Default color bold
  ctx.save();
  ctx.font = getFont(config.fontWeightBold, config);
  for (let i = 0; i < 256; i++) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * cellWidth, cellHeight, cellWidth, cellHeight);
    ctx.clip();
    ctx.fillText(String.fromCharCode(i), i * cellWidth, cellHeight);
    ctx.restore();
  }
  ctx.restore();

  // Colors 0-15
  ctx.font = getFont(config.fontWeight, config);
  for (let colorIndex = 0; colorIndex < 16; colorIndex++) {
    // colors 8-15 are bold
    if (colorIndex === 8) {
      ctx.font = getFont(config.fontWeightBold, config);
    }
    const y = (colorIndex + 2) * cellHeight;
    // Draw ascii characters
    for (let i = 0; i < 256; i++) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(i * cellWidth, y, cellWidth, cellHeight);
      ctx.clip();
      ctx.fillStyle = config.colors.ansi[colorIndex].css;
      ctx.fillText(String.fromCharCode(i), i * cellWidth, y);
      ctx.restore();
    }
  }
  ctx.restore();

  // Support is patchy for createImageBitmap at the moment, pass a canvas back
  // if support is lacking as drawImage works there too. Firefox is also
  // included here as ImageBitmap appears both buggy and has horrible
  // performance (tested on v55).
  if (!('createImageBitmap' in context) || isFirefox) {
    // Don't attempt to clear background colors if createImageBitmap is not supported
    if (canvas instanceof HTMLCanvasElement) {
      // Just return the HTMLCanvas if it's a HTMLCanvasElement
      return canvas;
    } else {
      // Transfer to an ImageBitmap is this is an OffscreenCanvas
      return new Promise(r => r(canvas.transferToImageBitmap()));
    }
  }

  const charAtlasImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Remove the background color from the image so characters may overlap
  const r = config.colors.background.rgba >>> 24;
  const g = config.colors.background.rgba >>> 16 & 0xFF;
  const b = config.colors.background.rgba >>> 8 & 0xFF;
  clearColor(charAtlasImageData, r, g, b);

  return context.createImageBitmap(charAtlasImageData);
}

/**
 * Makes a partiicular rgb color in an ImageData completely transparent.
 */
function clearColor(imageData: ImageData, r: number, g: number, b: number): void {
  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset] === r &&
        imageData.data[offset + 1] === g &&
        imageData.data[offset + 2] === b) {
      imageData.data[offset + 3] = 0;
    }
  }
}

function getFont(fontWeight: FontWeight, config: ICharAtlasConfig): string {
  return `${fontWeight} ${config.fontSize * config.devicePixelRatio}px ${config.fontFamily}`;
}
