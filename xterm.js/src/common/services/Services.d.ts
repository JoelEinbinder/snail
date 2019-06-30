/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IEvent } from 'common/EventEmitter';
import { IBuffer, IBufferSet } from 'common/buffer/Types';
import { IDecPrivateModes } from 'common/Types';

export interface IBufferService {
  readonly cols: number;
  readonly rows: number;
  readonly buffer: IBuffer;
  readonly buffers: IBufferSet;

  // TODO: Move resize event here

  resize(cols: number, rows: number): void;
  reset(): void;
}

export interface ICoreService {
  readonly decPrivateModes: IDecPrivateModes;

  readonly onData: IEvent<string>;
  readonly onUserInput: IEvent<void>;

  reset(): void;

  /**
   * Triggers the onData event in the public API.
   * @param data The data that is being emitted.
   * @param wasFromUser Whether the data originated from the user (as opposed to
   * resulting from parsing incoming data). When true this will also:
   * - Scroll to the bottom of the buffer.s
   * - Fire the `onUserInput` event (so selection can be cleared).
    */
    triggerDataEvent(data: string, wasUserInput?: boolean): void;
}

export interface IOptionsService {
  readonly options: ITerminalOptions;

  readonly onOptionChange: IEvent<string>;

  setOption<T>(key: string, value: T): void;
  getOption<T>(key: string): T | undefined;
}

export type FontWeight = 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

export type RendererType = 'dom' | 'canvas';

export interface IPartialTerminalOptions {
  allowTransparency?: boolean;
  bellSound?: string;
  bellStyle?: 'none' /*| 'visual'*/ | 'sound' /*| 'both'*/;
  cols?: number;
  cursorBlink?: boolean;
  cursorStyle?: 'block' | 'underline' | 'bar';
  disableStdin?: boolean;
  drawBoldTextInBrightColors?: boolean;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: FontWeight;
  fontWeightBold?: FontWeight;
  letterSpacing?: number;
  lineHeight?: number;
  macOptionIsMeta?: boolean;
  macOptionClickForcesSelection?: boolean;
  rendererType?: RendererType;
  rightClickSelectsWord?: boolean;
  rows?: number;
  screenReaderMode?: boolean;
  scrollback?: number;
  tabStopWidth?: number;
  theme?: ITheme;
  windowsMode?: boolean;
  wordSeparator?: string;
}

export interface ITerminalOptions {
  allowTransparency: boolean;
  bellSound: string;
  bellStyle: 'none' /*| 'visual'*/ | 'sound' /*| 'both'*/;
  cols: number;
  cursorBlink: boolean;
  cursorStyle: 'block' | 'underline' | 'bar';
  disableStdin: boolean;
  drawBoldTextInBrightColors: boolean;
  fontSize: number;
  fontFamily: string;
  fontWeight: FontWeight;
  fontWeightBold: FontWeight;
  letterSpacing: number;
  lineHeight: number;
  macOptionIsMeta: boolean;
  macOptionClickForcesSelection: boolean;
  rendererType: RendererType;
  rightClickSelectsWord: boolean;
  rows: number;
  screenReaderMode: boolean;
  scrollback: number;
  tabStopWidth: number;
  theme: ITheme;
  windowsMode: boolean;
  wordSeparator: string;

  [key: string]: any;
  cancelEvents: boolean;
  convertEol: boolean;
  debug: boolean;
  screenKeys: boolean;
  termName: string;
  useFlowControl: boolean;
}

export interface ITheme {
  foreground?: string;
  background?: string;
  cursor?: string;
  cursorAccent?: string;
  selection?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
}
