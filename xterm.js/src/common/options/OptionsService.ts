/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IOptionsService, ITerminalOptions, IPartialTerminalOptions } from 'common/options/Types';
import { EventEmitter2, IEvent } from 'common/EventEmitter2';
import { isMac } from 'common/Platform';
import { clone } from 'common/Clone';

// Source: https://freesound.org/people/altemark/sounds/45759/
// This sound is released under the Creative Commons Attribution 3.0 Unported
// (CC BY 3.0) license. It was created by 'altemark'. No modifications have been
// made, apart from the conversion to base64.
export const DEFAULT_BELL_SOUND = 'data:audio/wav;base64,UklGRigBAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQBAADpAFgCwAMlBZoG/wdmCcoKRAypDQ8PbRDBEQQTOxRtFYcWlBePGIUZXhoiG88bcBz7HHIdzh0WHlMeZx51HmkeUx4WHs8dah0AHXwc3hs9G4saxRnyGBIYGBcQFv8U4RPAEoYRQBACD70NWwwHC6gJOwjWBloF7gOBAhABkf8b/qv8R/ve+Xf4Ife79W/0JfPZ8Z/wde9N7ijtE+wU6xvqM+lb6H7nw+YX5mrlxuQz5Mzje+Ma49fioeKD4nXiYeJy4pHitOL04j/jn+MN5IPkFOWs5U3mDefM55/ogOl36m7rdOyE7abuyu8D8Unyj/Pg9D/2qfcb+Yn6/vuK/Qj/lAAlAg==';

// TODO: Freeze?
const DEFAULT_OPTIONS: ITerminalOptions = {
  cols: 80,
  rows: 24,
  cursorBlink: false,
  cursorStyle: 'block',
  bellSound:  DEFAULT_BELL_SOUND,
  bellStyle: 'none',
  drawBoldTextInBrightColors: true,
  fontFamily: 'courier-new, courier, monospace',
  fontSize: 15,
  fontWeight: 'normal',
  fontWeightBold: 'bold',
  lineHeight: 1.0,
  letterSpacing: 0,
  scrollback: 1000,
  screenReaderMode: false,
  macOptionIsMeta: false,
  macOptionClickForcesSelection: false,
  disableStdin: false,
  allowTransparency: false,
  tabStopWidth: 8,
  theme: {},
  rightClickSelectsWord: isMac,
  rendererType: 'canvas',
  windowsMode: false,

  convertEol: false,
  termName: 'xterm',
  screenKeys: false,
  debug: false,
  cancelEvents: false,
  useFlowControl: false
};

/**
 * The set of options that only have an effect when set in the Terminal constructor.
 */
const CONSTRUCTOR_ONLY_OPTIONS = ['cols', 'rows'];

export class OptionsService implements IOptionsService {
  public options: ITerminalOptions;

  private _onOptionChange = new EventEmitter2<string>();
  public get onOptionChange(): IEvent<string> { return this._onOptionChange.event; }

  constructor(options: IPartialTerminalOptions) {
    this.options = clone(DEFAULT_OPTIONS);
    Object.keys(options).forEach(k => {
      if (k in this.options) {
        const newValue = options[k as keyof IPartialTerminalOptions] as any;
        this.options[k] = newValue;
      }
    });
  }

  public setOption(key: string, value: any): void {
    if (!(key in DEFAULT_OPTIONS)) {
      throw new Error('No option with key "' + key + '"');
    }
    if (CONSTRUCTOR_ONLY_OPTIONS.indexOf(key) !== -1) {
      throw new Error(`Option "${key}" can only be set in the constructor`);
    }
    if (this.options[key] === value) {
      return;
    }

    value = this._sanitizeAndValidateOption(key, value);

    // Don't fire an option change event if they didn't change
    if (this.options[key] === value) {
      return;
    }

    this.options[key] = value;
    this._onOptionChange.fire(key);
  }

  private _sanitizeAndValidateOption(key: string, value: any): any {
    switch (key) {
      case 'bellStyle':
      case 'cursorStyle':
      case 'fontWeight':
      case 'fontWeightBold':
      case 'rendererType':
        if (!value) {
          value = DEFAULT_OPTIONS[key];
        }
        break;
      case 'lineHeight':
      case 'tabStopWidth':
        if (value < 1) {
          throw new Error(`${key} cannot be less than 1, value: ${value}`);
        }
        break;
      case 'scrollback':
        value = Math.min(value, 4294967295);
        if (value < 0) {
          throw new Error(`${key} cannot be less than 0, value: ${value}`);
        }
        break;
    }
    return value;
  }

  public getOption(key: string): any {
    if (!(key in DEFAULT_OPTIONS)) {
      throw new Error(`No option with key "${key}"`);
    }
    return this.options[key];
  }
}
