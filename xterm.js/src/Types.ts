/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

export type LinkMatcherHandler = (event: MouseEvent, uri: string) => boolean | void;
export type LinkMatcherValidationCallback = (uri: string, callback: (isValid: boolean) => void) => void;

export type CustomKeyEventHandler = (event: KeyboardEvent) => boolean;

export type CharData = [number, string, number, number];
export type LineData = CharData[];

export enum LinkHoverEventTypes {
  HOVER = 'linkhover',
  TOOLTIP = 'linktooltip',
  LEAVE = 'linkleave'
}

export type FontWeight = 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
