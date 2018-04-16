/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { DIM_OPACITY, IGlyphIdentifier, INVERTED_DEFAULT_COLOR } from './Types';
import { ICharAtlasConfig } from '../../shared/atlas/Types';
import BaseCharAtlas from './BaseCharAtlas';
import { clearColor } from '../../shared/atlas/CharAtlasGenerator';
import LRUMap from './LRUMap';

// In practice we're probably never going to exhaust a texture this large. For debugging purposes,
// however, it can be useful to set this to a really tiny value, to verify that LRU eviction works.
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 1024;

const TRANSPARENT_COLOR = {
  css: 'rgba(0, 0, 0, 0)',
  rgba: 0,
}

interface IGlyphCacheValue {
  index: number;
  isEmpty: boolean;
}

function getGlyphCacheKey(glyph: IGlyphIdentifier): string {
  return `${glyph.bg}_${glyph.fg}_${glyph.bold ? 0 : 1}${glyph.dim ? 0 : 1}${glyph.char}`;
}

export default class DynamicCharAtlas extends BaseCharAtlas {
  // An ordered map that we're using to keep track of where each glyph is in the atlas texture.
  // It's ordered so that we can determine when to remove the old entries.
  private _cacheMap: LRUMap<IGlyphCacheValue>;

  // The texture that the atlas is drawn to
  private _cacheCanvas: HTMLCanvasElement;
  private _cacheCtx: CanvasRenderingContext2D;

  // A couple temporary canvases that glyphs are drawn to before being transfered to the atlas.
  //
  // We'll use the a ctx without alpha when possible, because that will preserve subpixel RGB
  // anti-aliasing, and we'll fall back to a canvas with alpha when we have to.
  private _tmpCtx: CanvasRenderingContext2D;
  private _tmpCtxWithAlpha: CanvasRenderingContext2D;

  // The number of characters stored in the atlas by width/height
  private _width: number;
  private _height: number;

  constructor(document: Document, private _config: ICharAtlasConfig) {
    super();
    this._cacheCanvas = document.createElement('canvas');
    this._cacheCanvas.width = TEXTURE_WIDTH;
    this._cacheCanvas.height = TEXTURE_HEIGHT;
    // The canvas needs alpha because we use clearColor to convert the background color to alpha.
    // It might also contain some characters with transparent backgrounds if allowTransparency is
    // set.
    this._cacheCtx = this._cacheCanvas.getContext('2d', {alpha: true});

    // define a canvas/ctx for drawing glyphs with opaque backgrounds
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = this._config.scaledCharWidth;
    tmpCanvas.height = this._config.scaledCharHeight;
    this._tmpCtx = tmpCanvas.getContext('2d', {alpha: false});
    // and define a canvas/ctx for glyphs with transparent backgrounds
    const tmpCanvasWithAlpha = document.createElement('canvas');
    tmpCanvasWithAlpha.width = this._config.scaledCharWidth;
    tmpCanvasWithAlpha.height = this._config.scaledCharHeight;
    this._tmpCtxWithAlpha = tmpCanvasWithAlpha.getContext('2d', {alpha: true});

    this._width = Math.floor(TEXTURE_WIDTH / this._config.scaledCharWidth);
    this._height = Math.floor(TEXTURE_HEIGHT / this._config.scaledCharHeight);
    const capacity = this._width * this._height;
    this._cacheMap = new LRUMap(capacity);
    this._cacheMap.prealloc(capacity);

    // This is useful for debugging
    // document.body.appendChild(this._cacheCanvas);
  }

  public draw(
    ctx: CanvasRenderingContext2D,
    glyph: IGlyphIdentifier,
    x: number,
    y: number,
  ): boolean {
    const glyphKey = getGlyphCacheKey(glyph);
    const cacheValue = this._cacheMap.get(glyphKey);
    if (cacheValue != null) {
      this._drawFromCache(ctx, cacheValue, x, y);
      return true;
    } else if (this._canCache(glyph)) {
      let index;
      if (this._cacheMap.size < this._cacheMap.capacity) {
        index = this._cacheMap.size;
      } else {
        // we're out of space, so our call to set will delete this item
        index = this._cacheMap.peek().index;
      }
      const cacheValue = this._drawToCache(glyph, index);
      this._cacheMap.set(glyphKey, cacheValue);
      this._drawFromCache(ctx, cacheValue, x, y);
      return true;
    } else {
      return false;
    }
  }

  private _canCache(glyph: IGlyphIdentifier): boolean {
    // Only cache ascii and extended characters for now, to be safe. In the future, we could do
    // something more complicated to determine the expected width of a character.
    //
    // If we switch the renderer over to webgl at some point, we may be able to use blending modes
    // to draw overlapping glyphs from the atlas:
    // https://github.com/servo/webrender/issues/464#issuecomment-255632875
    // https://webglfundamentals.org/webgl/lessons/webgl-text-texture.html
    return glyph.char.charCodeAt(0) < 256;
  }

  private _toCoordinates(index: number): [number, number] {
    return [
      (index % this._width) * this._config.scaledCharWidth,
      Math.floor(index / this._width) * this._config.scaledCharHeight
    ];
  }

  private _drawFromCache(
    ctx: CanvasRenderingContext2D,
    cacheValue: IGlyphCacheValue,
    x: number,
    y: number
  ): void {
    // We don't actually need to do anything if this is whitespace.
    if (cacheValue.isEmpty) {
      return;
    }
    const [cacheX, cacheY] = this._toCoordinates(cacheValue.index);
    ctx.drawImage(
      this._cacheCanvas,
      cacheX,
      cacheY,
      this._config.scaledCharWidth,
      this._config.scaledCharHeight,
      x,
      y,
      this._config.scaledCharWidth,
      this._config.scaledCharHeight,
    );
  }

  // TODO: We do this (or something similar) in multiple places. We should split this off
  // into a shared function.
  private _drawToCache(glyph: IGlyphIdentifier, index: number): IGlyphCacheValue {

    // draw the background
    let backgroundColor = this._config.colors.background;
    if (glyph.bg === INVERTED_DEFAULT_COLOR) {
      backgroundColor = this._config.colors.foreground;
    } else if (glyph.bg < 256) {
      backgroundColor = this._config.colors.ansi[glyph.bg];
    }

    let ctx = this._tmpCtx;
    let backgroundIsTransparent = false;
    if ((backgroundColor.rgba & 0xFF) !== 0xFF) {
      // The background color has some transparency, so we need to render it as fully transparent
      // in the atlas. Otherwise we'd end up drawing the transparent background twice around the
      // anti-aliased edges of the glyph, and it would look too dark.
      //
      // This has the side-effect of disabling RGB subpixel antialiasing, but most compositors will
      // disable that anyways on a partially transparent background for similar reasons.
      backgroundColor = TRANSPARENT_COLOR;
      ctx = this._tmpCtxWithAlpha;
      backgroundIsTransparent = true;
    }
    ctx.save();

    // Use a 'copy' composite operation to clear any existing glyph out of _tmpCtxWithAlpha, regardless of
    // transparency in backgroundColor
    ctx.globalCompositeOperation = 'copy';
    ctx.fillStyle = backgroundColor.css;
    ctx.fillRect(0, 0, this._config.scaledCharWidth, this._config.scaledCharHeight);
    ctx.globalCompositeOperation = 'source-over';

    // draw the foreground/glyph
    ctx.font =
      `${this._config.fontSize * this._config.devicePixelRatio}px ${this._config.fontFamily}`;
    if (glyph.bold) {
      ctx.font = `bold ${ctx.font}`;
    }
    ctx.textBaseline = 'top';

    if (glyph.fg === INVERTED_DEFAULT_COLOR) {
      ctx.fillStyle = this._config.colors.background.css;
    } else if (glyph.fg < 256) {
      // 256 color support
      ctx.fillStyle = this._config.colors.ansi[glyph.fg].css;
    } else {
      ctx.fillStyle = this._config.colors.foreground.css;
    }

    // Apply alpha to dim the character
    if (glyph.dim) {
      ctx.globalAlpha = DIM_OPACITY;
    }
    // Draw the character
    ctx.fillText(glyph.char, 0, 0);
    ctx.restore();

    // clear the background from the character to avoid issues with drawing over the previous
    // character if it extends past it's bounds
    const imageData = ctx.getImageData(
      0, 0, this._config.scaledCharWidth, this._config.scaledCharHeight,
    );
    let isEmpty = false;
    if (!backgroundIsTransparent) {
      isEmpty = clearColor(imageData, backgroundColor);
    }

    // copy the data from imageData to _cacheCanvas
    const [x, y] = this._toCoordinates(index);
    // putImageData doesn't do any blending, so it will overwrite any existing cache entry for us
    this._cacheCtx.putImageData(imageData, x, y);

    return {
      index,
      isEmpty,
    };
  }
}
