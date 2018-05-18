/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal } from '../../Types';
import { IColorSet } from '../Types';
import { ICharAtlasConfig } from '../../shared/atlas/Types';

export function generateConfig(scaledCharWidth: number, scaledCharHeight: number, terminal: ITerminal, colors: IColorSet): ICharAtlasConfig {
  // null out some fields that don't matter
  const clonedColors = {
    foreground: colors.foreground,
    background: colors.background,
    cursor: null,
    cursorAccent: null,
    selection: null,
    // For the static char atlas, we only use the first 16 colors, but we need all 256 for the
    // dynamic character atlas.
    ansi: colors.ansi.slice(0, 16)
  };
  return {
    type: terminal.options.experimentalCharAtlas,
    devicePixelRatio: window.devicePixelRatio,
    scaledCharWidth,
    scaledCharHeight,
    fontFamily: terminal.options.fontFamily,
    fontSize: terminal.options.fontSize,
    fontWeight: terminal.options.fontWeight,
    fontWeightBold: terminal.options.fontWeightBold,
    allowTransparency: terminal.options.allowTransparency,
    colors: clonedColors
  };
}

export function configEquals(a: ICharAtlasConfig, b: ICharAtlasConfig): boolean {
  for (let i = 0; i < a.colors.ansi.length; i++) {
    if (a.colors.ansi[i].rgba !== b.colors.ansi[i].rgba) {
      return false;
    }
  }
  return a.type === b.type &&
      a.devicePixelRatio === b.devicePixelRatio &&
      a.fontFamily === b.fontFamily &&
      a.fontSize === b.fontSize &&
      a.fontWeight === b.fontWeight &&
      a.fontWeightBold === b.fontWeightBold &&
      a.allowTransparency === b.allowTransparency &&
      a.scaledCharWidth === b.scaledCharWidth &&
      a.scaledCharHeight === b.scaledCharHeight &&
      a.colors.foreground === b.colors.foreground &&
      a.colors.background === b.colors.background;
}
