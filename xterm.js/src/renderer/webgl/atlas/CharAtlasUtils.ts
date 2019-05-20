/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ICharAtlasConfig } from './Types';
import { DEFAULT_COLOR } from '../../../common/Types';
import { IColorSet, Terminal, FontWeight } from 'xterm';

export function generateConfig(scaledCharWidth: number, scaledCharHeight: number, terminal: Terminal, colors: IColorSet): ICharAtlasConfig {
  // null out some fields that don't matter
  const clonedColors: IColorSet = {
    foreground: colors.foreground,
    background: colors.background,
    cursor: null,
    cursorAccent: null,
    selection: null,
    // For the static char atlas, we only use the first 16 colors, but we need all 256 for the
    // dynamic character atlas.
    ansi: colors.ansi.slice()
  };
  return {
    devicePixelRatio: window.devicePixelRatio,
    scaledCharWidth,
    scaledCharHeight,
    fontFamily: terminal.getOption('fontFamily'),
    fontSize: terminal.getOption('fontSize'),
    fontWeight: terminal.getOption('fontWeight') as FontWeight,
    fontWeightBold: terminal.getOption('fontWeightBold') as FontWeight,
    allowTransparency: terminal.getOption('allowTransparency'),
    colors: clonedColors
  };
}

export function configEquals(a: ICharAtlasConfig, b: ICharAtlasConfig): boolean {
  for (let i = 0; i < a.colors.ansi.length; i++) {
    if (a.colors.ansi[i].rgba !== b.colors.ansi[i].rgba) {
      return false;
    }
  }
  return a.devicePixelRatio === b.devicePixelRatio &&
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

export function is256Color(colorCode: number): boolean {
  return colorCode < DEFAULT_COLOR;
}
