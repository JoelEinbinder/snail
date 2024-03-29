/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { FontWeight } from 'xterm';
import type { IColorSet } from 'browser/Types';

export interface IGlyphIdentifier {
  chars: string;
  code: number;
  bg: number;
  fg: number;
  bold: boolean;
  dim: boolean;
  italic: boolean;
}

export interface ICharAtlasConfig {
  customGlyphs: boolean;
  devicePixelRatio: number;
  letterSpacing: number;
  lineHeight: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: FontWeight;
  fontWeightBold: FontWeight;
  scaledCellWidth: number;
  scaledCellHeight: number;
  scaledCharWidth: number;
  scaledCharHeight: number;
  allowTransparency: boolean;
  drawBoldTextInBrightColors: boolean;
  minimumContrastRatio: number;
  colors: IColorSet;
}
