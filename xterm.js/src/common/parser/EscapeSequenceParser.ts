/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { IParsingState, IDcsHandler, IEscapeSequenceParser, IParams } from 'common/parser/Types';
import { ParserState, ParserAction } from 'common/parser/Constants';
import { Disposable } from 'common/Lifecycle';
import { utf32ToString } from 'common/input/TextDecoder';
import { IDisposable } from 'common/Types';
import { fill } from 'common/TypedArrayUtils';
import { Params } from 'common/parser/Params';

interface IHandlerCollection<T> {
  [key: string]: T[];
}

type CsiHandler = (params: IParams, collect: string) => boolean | void;
type OscHandler = (data: string) => boolean | void;

/**
 * Table values are generated like this:
 *    index:  currentState << TableValue.INDEX_STATE_SHIFT | charCode
 *    value:  action << TableValue.TRANSITION_ACTION_SHIFT | nextState
 */
const enum TableAccess {
  TRANSITION_ACTION_SHIFT = 4,
  TRANSITION_STATE_MASK = 15,
  INDEX_STATE_SHIFT = 8
}

/**
 * Transition table for EscapeSequenceParser.
 */
export class TransitionTable {
  public table: Uint8Array;

  constructor(length: number) {
    this.table = new Uint8Array(length);
  }

  /**
   * Set default transition.
   * @param action default action
   * @param next default next state
   */
  public setDefault(action: ParserAction, next: ParserState): void {
    fill(this.table, action << TableAccess.TRANSITION_ACTION_SHIFT | next);
  }

  /**
   * Add a transition to the transition table.
   * @param code input character code
   * @param state current parser state
   * @param action parser action to be done
   * @param next next parser state
   */
  public add(code: number, state: ParserState, action: ParserAction, next: ParserState): void {
    this.table[state << TableAccess.INDEX_STATE_SHIFT | code] = action << TableAccess.TRANSITION_ACTION_SHIFT | next;
  }

  /**
   * Add transitions for multiple input character codes.
   * @param codes input character code array
   * @param state current parser state
   * @param action parser action to be done
   * @param next next parser state
   */
  public addMany(codes: number[], state: ParserState, action: ParserAction, next: ParserState): void {
    for (let i = 0; i < codes.length; i++) {
      this.table[state << TableAccess.INDEX_STATE_SHIFT | codes[i]] = action << TableAccess.TRANSITION_ACTION_SHIFT | next;
    }
  }
}


// Pseudo-character placeholder for printable non-ascii characters (unicode).
const NON_ASCII_PRINTABLE = 0xA0;


/**
 * VT500 compatible transition table.
 * Taken from https://vt100.net/emu/dec_ansi_parser.
 */
export const VT500_TRANSITION_TABLE = (function (): TransitionTable {
  const table: TransitionTable = new TransitionTable(4095);

  // range macro for byte
  const BYTE_VALUES = 256;
  const blueprint = Array.apply(null, Array(BYTE_VALUES)).map((unused: any, i: number) => i);
  const r = (start: number, end: number) => blueprint.slice(start, end);

  // Default definitions.
  const PRINTABLES = r(0x20, 0x7f); // 0x20 (SP) included, 0x7F (DEL) excluded
  const EXECUTABLES = r(0x00, 0x18);
  EXECUTABLES.push(0x19);
  EXECUTABLES.push.apply(EXECUTABLES, r(0x1c, 0x20));

  const states: number[] = r(ParserState.GROUND, ParserState.DCS_PASSTHROUGH + 1);
  let state: any;

  // set default transition
  table.setDefault(ParserAction.ERROR, ParserState.GROUND);
  // printables
  table.addMany(PRINTABLES, ParserState.GROUND, ParserAction.PRINT, ParserState.GROUND);
  // global anywhere rules
  for (state in states) {
    table.addMany([0x18, 0x1a, 0x99, 0x9a], state, ParserAction.EXECUTE, ParserState.GROUND);
    table.addMany(r(0x80, 0x90), state, ParserAction.EXECUTE, ParserState.GROUND);
    table.addMany(r(0x90, 0x98), state, ParserAction.EXECUTE, ParserState.GROUND);
    table.add(0x9c, state, ParserAction.IGNORE, ParserState.GROUND); // ST as terminator
    table.add(0x1b, state, ParserAction.CLEAR, ParserState.ESCAPE);  // ESC
    table.add(0x9d, state, ParserAction.OSC_START, ParserState.OSC_STRING);  // OSC
    table.addMany([0x98, 0x9e, 0x9f], state, ParserAction.IGNORE, ParserState.SOS_PM_APC_STRING);
    table.add(0x9b, state, ParserAction.CLEAR, ParserState.CSI_ENTRY);  // CSI
    table.add(0x90, state, ParserAction.CLEAR, ParserState.DCS_ENTRY);  // DCS
  }
  // rules for executables and 7f
  table.addMany(EXECUTABLES, ParserState.GROUND, ParserAction.EXECUTE, ParserState.GROUND);
  table.addMany(EXECUTABLES, ParserState.ESCAPE, ParserAction.EXECUTE, ParserState.ESCAPE);
  table.add(0x7f, ParserState.ESCAPE, ParserAction.IGNORE, ParserState.ESCAPE);
  table.addMany(EXECUTABLES, ParserState.OSC_STRING, ParserAction.IGNORE, ParserState.OSC_STRING);
  table.addMany(EXECUTABLES, ParserState.CSI_ENTRY, ParserAction.EXECUTE, ParserState.CSI_ENTRY);
  table.add(0x7f, ParserState.CSI_ENTRY, ParserAction.IGNORE, ParserState.CSI_ENTRY);
  table.addMany(EXECUTABLES, ParserState.CSI_PARAM, ParserAction.EXECUTE, ParserState.CSI_PARAM);
  table.add(0x7f, ParserState.CSI_PARAM, ParserAction.IGNORE, ParserState.CSI_PARAM);
  table.addMany(EXECUTABLES, ParserState.CSI_IGNORE, ParserAction.EXECUTE, ParserState.CSI_IGNORE);
  table.addMany(EXECUTABLES, ParserState.CSI_INTERMEDIATE, ParserAction.EXECUTE, ParserState.CSI_INTERMEDIATE);
  table.add(0x7f, ParserState.CSI_INTERMEDIATE, ParserAction.IGNORE, ParserState.CSI_INTERMEDIATE);
  table.addMany(EXECUTABLES, ParserState.ESCAPE_INTERMEDIATE, ParserAction.EXECUTE, ParserState.ESCAPE_INTERMEDIATE);
  table.add(0x7f, ParserState.ESCAPE_INTERMEDIATE, ParserAction.IGNORE, ParserState.ESCAPE_INTERMEDIATE);
  // osc
  table.add(0x5d, ParserState.ESCAPE, ParserAction.OSC_START, ParserState.OSC_STRING);
  table.addMany(PRINTABLES, ParserState.OSC_STRING, ParserAction.OSC_PUT, ParserState.OSC_STRING);
  table.add(0x7f, ParserState.OSC_STRING, ParserAction.OSC_PUT, ParserState.OSC_STRING);
  table.addMany([0x9c, 0x1b, 0x18, 0x1a, 0x07], ParserState.OSC_STRING, ParserAction.OSC_END, ParserState.GROUND);
  table.addMany(r(0x1c, 0x20), ParserState.OSC_STRING, ParserAction.IGNORE, ParserState.OSC_STRING);
  // sos/pm/apc does nothing
  table.addMany([0x58, 0x5e, 0x5f], ParserState.ESCAPE, ParserAction.IGNORE, ParserState.SOS_PM_APC_STRING);
  table.addMany(PRINTABLES, ParserState.SOS_PM_APC_STRING, ParserAction.IGNORE, ParserState.SOS_PM_APC_STRING);
  table.addMany(EXECUTABLES, ParserState.SOS_PM_APC_STRING, ParserAction.IGNORE, ParserState.SOS_PM_APC_STRING);
  table.add(0x9c, ParserState.SOS_PM_APC_STRING, ParserAction.IGNORE, ParserState.GROUND);
  table.add(0x7f, ParserState.SOS_PM_APC_STRING, ParserAction.IGNORE, ParserState.SOS_PM_APC_STRING);
  // csi entries
  table.add(0x5b, ParserState.ESCAPE, ParserAction.CLEAR, ParserState.CSI_ENTRY);
  table.addMany(r(0x40, 0x7f), ParserState.CSI_ENTRY, ParserAction.CSI_DISPATCH, ParserState.GROUND);
  table.addMany(r(0x30, 0x3c), ParserState.CSI_ENTRY, ParserAction.PARAM, ParserState.CSI_PARAM);
  table.addMany([0x3c, 0x3d, 0x3e, 0x3f], ParserState.CSI_ENTRY, ParserAction.COLLECT, ParserState.CSI_PARAM);
  table.addMany(r(0x30, 0x3c), ParserState.CSI_PARAM, ParserAction.PARAM, ParserState.CSI_PARAM);
  table.addMany(r(0x40, 0x7f), ParserState.CSI_PARAM, ParserAction.CSI_DISPATCH, ParserState.GROUND);
  table.addMany([0x3c, 0x3d, 0x3e, 0x3f], ParserState.CSI_PARAM, ParserAction.IGNORE, ParserState.CSI_IGNORE);
  table.addMany(r(0x20, 0x40), ParserState.CSI_IGNORE, ParserAction.IGNORE, ParserState.CSI_IGNORE);
  table.add(0x7f, ParserState.CSI_IGNORE, ParserAction.IGNORE, ParserState.CSI_IGNORE);
  table.addMany(r(0x40, 0x7f), ParserState.CSI_IGNORE, ParserAction.IGNORE, ParserState.GROUND);
  table.addMany(r(0x20, 0x30), ParserState.CSI_ENTRY, ParserAction.COLLECT, ParserState.CSI_INTERMEDIATE);
  table.addMany(r(0x20, 0x30), ParserState.CSI_INTERMEDIATE, ParserAction.COLLECT, ParserState.CSI_INTERMEDIATE);
  table.addMany(r(0x30, 0x40), ParserState.CSI_INTERMEDIATE, ParserAction.IGNORE, ParserState.CSI_IGNORE);
  table.addMany(r(0x40, 0x7f), ParserState.CSI_INTERMEDIATE, ParserAction.CSI_DISPATCH, ParserState.GROUND);
  table.addMany(r(0x20, 0x30), ParserState.CSI_PARAM, ParserAction.COLLECT, ParserState.CSI_INTERMEDIATE);
  // esc_intermediate
  table.addMany(r(0x20, 0x30), ParserState.ESCAPE, ParserAction.COLLECT, ParserState.ESCAPE_INTERMEDIATE);
  table.addMany(r(0x20, 0x30), ParserState.ESCAPE_INTERMEDIATE, ParserAction.COLLECT, ParserState.ESCAPE_INTERMEDIATE);
  table.addMany(r(0x30, 0x7f), ParserState.ESCAPE_INTERMEDIATE, ParserAction.ESC_DISPATCH, ParserState.GROUND);
  table.addMany(r(0x30, 0x50), ParserState.ESCAPE, ParserAction.ESC_DISPATCH, ParserState.GROUND);
  table.addMany(r(0x51, 0x58), ParserState.ESCAPE, ParserAction.ESC_DISPATCH, ParserState.GROUND);
  table.addMany([0x59, 0x5a, 0x5c], ParserState.ESCAPE, ParserAction.ESC_DISPATCH, ParserState.GROUND);
  table.addMany(r(0x60, 0x7f), ParserState.ESCAPE, ParserAction.ESC_DISPATCH, ParserState.GROUND);
  // dcs entry
  table.add(0x50, ParserState.ESCAPE, ParserAction.CLEAR, ParserState.DCS_ENTRY);
  table.addMany(EXECUTABLES, ParserState.DCS_ENTRY, ParserAction.IGNORE, ParserState.DCS_ENTRY);
  table.add(0x7f, ParserState.DCS_ENTRY, ParserAction.IGNORE, ParserState.DCS_ENTRY);
  table.addMany(r(0x1c, 0x20), ParserState.DCS_ENTRY, ParserAction.IGNORE, ParserState.DCS_ENTRY);
  table.addMany(r(0x20, 0x30), ParserState.DCS_ENTRY, ParserAction.COLLECT, ParserState.DCS_INTERMEDIATE);
  table.addMany(r(0x30, 0x3c), ParserState.DCS_ENTRY, ParserAction.PARAM, ParserState.DCS_PARAM);
  table.addMany([0x3c, 0x3d, 0x3e, 0x3f], ParserState.DCS_ENTRY, ParserAction.COLLECT, ParserState.DCS_PARAM);
  table.addMany(EXECUTABLES, ParserState.DCS_IGNORE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.addMany(r(0x20, 0x80), ParserState.DCS_IGNORE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.addMany(r(0x1c, 0x20), ParserState.DCS_IGNORE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.addMany(EXECUTABLES, ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_PARAM);
  table.add(0x7f, ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_PARAM);
  table.addMany(r(0x1c, 0x20), ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_PARAM);
  table.addMany(r(0x30, 0x3c), ParserState.DCS_PARAM, ParserAction.PARAM, ParserState.DCS_PARAM);
  table.addMany([0x3c, 0x3d, 0x3e, 0x3f], ParserState.DCS_PARAM, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.addMany(r(0x20, 0x30), ParserState.DCS_PARAM, ParserAction.COLLECT, ParserState.DCS_INTERMEDIATE);
  table.addMany(EXECUTABLES, ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_INTERMEDIATE);
  table.add(0x7f, ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_INTERMEDIATE);
  table.addMany(r(0x1c, 0x20), ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_INTERMEDIATE);
  table.addMany(r(0x20, 0x30), ParserState.DCS_INTERMEDIATE, ParserAction.COLLECT, ParserState.DCS_INTERMEDIATE);
  table.addMany(r(0x30, 0x40), ParserState.DCS_INTERMEDIATE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.addMany(r(0x40, 0x7f), ParserState.DCS_INTERMEDIATE, ParserAction.DCS_HOOK, ParserState.DCS_PASSTHROUGH);
  table.addMany(r(0x40, 0x7f), ParserState.DCS_PARAM, ParserAction.DCS_HOOK, ParserState.DCS_PASSTHROUGH);
  table.addMany(r(0x40, 0x7f), ParserState.DCS_ENTRY, ParserAction.DCS_HOOK, ParserState.DCS_PASSTHROUGH);
  table.addMany(EXECUTABLES, ParserState.DCS_PASSTHROUGH, ParserAction.DCS_PUT, ParserState.DCS_PASSTHROUGH);
  table.addMany(PRINTABLES, ParserState.DCS_PASSTHROUGH, ParserAction.DCS_PUT, ParserState.DCS_PASSTHROUGH);
  table.add(0x7f, ParserState.DCS_PASSTHROUGH, ParserAction.IGNORE, ParserState.DCS_PASSTHROUGH);
  table.addMany([0x1b, 0x9c], ParserState.DCS_PASSTHROUGH, ParserAction.DCS_UNHOOK, ParserState.GROUND);
  // special handling of unicode chars
  table.add(NON_ASCII_PRINTABLE, ParserState.GROUND, ParserAction.PRINT, ParserState.GROUND);
  table.add(NON_ASCII_PRINTABLE, ParserState.OSC_STRING, ParserAction.OSC_PUT, ParserState.OSC_STRING);
  table.add(NON_ASCII_PRINTABLE, ParserState.CSI_IGNORE, ParserAction.IGNORE, ParserState.CSI_IGNORE);
  table.add(NON_ASCII_PRINTABLE, ParserState.DCS_IGNORE, ParserAction.IGNORE, ParserState.DCS_IGNORE);
  table.add(NON_ASCII_PRINTABLE, ParserState.DCS_PASSTHROUGH, ParserAction.DCS_PUT, ParserState.DCS_PASSTHROUGH);
  return table;
})();

/**
 * Dummy DCS handler as default fallback.
 */
class DcsDummy implements IDcsHandler {
  hook(collect: string, params: IParams, flag: number): void { }
  put(data: Uint32Array, start: number, end: number): void { }
  unhook(): void { }
}

/**
 * EscapeSequenceParser.
 * This class implements the ANSI/DEC compatible parser described by
 * Paul Williams (https://vt100.net/emu/dec_ansi_parser).
 *
 * To implement custom ANSI compliant escape sequences it is not needed to
 * alter this parser, instead consider registering a custom handler.
 * For non ANSI compliant sequences change the transition table with
 * the optional `transitions` contructor argument and
 * reimplement the `parse` method.
 *
 * This parser is currently hardcoded to operate in ZDM (Zero Default Mode)
 * as suggested by the original parser, thus empty parameters are set to 0.
 * This this is not in line with the latest ECMA specification
 * (ZDM was part of the early specs and got completely removed later on).
 *
 * Other than the original parser from vt100.net this parser supports
 * sub parameters in digital parameters separated by colons. Empty sub parameters
 * are set to -1.
 *
 * TODO: implement error recovery hook via error handler return values
 */
export class EscapeSequenceParser extends Disposable implements IEscapeSequenceParser {
  public initialState: number;
  public currentState: number;
  public precedingCodepoint: number;

  // buffers over several parse calls
  protected _osc: string;
  protected _params: Params;
  protected _collect: string;

  // handler lookup containers
  protected _printHandler: (data: Uint32Array, start: number, end: number) => void;
  protected _executeHandlers: any;
  protected _csiHandlers: IHandlerCollection<CsiHandler>;
  protected _escHandlers: any;
  protected _oscHandlers: IHandlerCollection<OscHandler>;
  protected _dcsHandlers: any;
  protected _activeDcsHandler: IDcsHandler | null;
  protected _errorHandler: (state: IParsingState) => IParsingState;

  // fallback handlers
  protected _printHandlerFb: (data: Uint32Array, start: number, end: number) => void;
  protected _executeHandlerFb: (code: number) => void;
  protected _csiHandlerFb: (collect: string, params: IParams, flag: number) => void;
  protected _escHandlerFb: (collect: string, flag: number) => void;
  protected _oscHandlerFb: (identifier: number, data: string) => void;
  protected _dcsHandlerFb: IDcsHandler;
  protected _errorHandlerFb: (state: IParsingState) => IParsingState;

  constructor(readonly TRANSITIONS: TransitionTable = VT500_TRANSITION_TABLE) {
    super();

    this.initialState = ParserState.GROUND;
    this.currentState = this.initialState;
    this._osc = '';
    this._params = new Params(); // defaults to 32 storable params/subparams
    this._params.addParam(0);    // ZDM
    this._collect = '';
    this.precedingCodepoint = 0;

    // set default fallback handlers and handler lookup containers
    this._printHandlerFb = (data, start, end): void => { };
    this._executeHandlerFb = (code: number): void => { };
    this._csiHandlerFb = (collect: string, params: IParams, flag: number): void => { };
    this._escHandlerFb = (collect: string, flag: number): void => { };
    this._oscHandlerFb = (identifier: number, data: string): void => { };
    this._dcsHandlerFb = new DcsDummy();
    this._errorHandlerFb = (state: IParsingState): IParsingState => state;
    this._printHandler = this._printHandlerFb;
    this._executeHandlers = Object.create(null);
    this._csiHandlers = Object.create(null);
    this._escHandlers = Object.create(null);
    this._oscHandlers = Object.create(null);
    this._dcsHandlers = Object.create(null);
    this._activeDcsHandler = null;
    this._errorHandler = this._errorHandlerFb;

    // swallow 7bit ST (ESC+\)
    this.setEscHandler('\\', () => {});
  }

  public dispose(): void {
    this._executeHandlers = null;
    this._escHandlers = null;
    this._dcsHandlers = null;
    this._activeDcsHandler = null;
  }

  setPrintHandler(callback: (data: Uint32Array, start: number, end: number) => void): void {
    this._printHandler = callback;
  }
  clearPrintHandler(): void {
    this._printHandler = this._printHandlerFb;
  }

  setExecuteHandler(flag: string, callback: () => void): void {
    this._executeHandlers[flag.charCodeAt(0)] = callback;
  }
  clearExecuteHandler(flag: string): void {
    if (this._executeHandlers[flag.charCodeAt(0)]) delete this._executeHandlers[flag.charCodeAt(0)];
  }
  setExecuteHandlerFallback(callback: (code: number) => void): void {
    this._executeHandlerFb = callback;
  }

  addCsiHandler(flag: string, callback: CsiHandler): IDisposable {
    const index = flag.charCodeAt(0);
    if (this._csiHandlers[index] === undefined) {
      this._csiHandlers[index] = [];
    }
    const handlerList = this._csiHandlers[index];
    handlerList.push(callback);
    return {
      dispose: () => {
        const handlerIndex = handlerList.indexOf(callback);
        if (handlerIndex !== -1) {
          handlerList.splice(handlerIndex, 1);
        }
      }
    };
  }
  setCsiHandler(flag: string, callback: (params: IParams, collect: string) => void): void {
    this._csiHandlers[flag.charCodeAt(0)] = [callback];
  }
  clearCsiHandler(flag: string): void {
    if (this._csiHandlers[flag.charCodeAt(0)]) delete this._csiHandlers[flag.charCodeAt(0)];
  }
  setCsiHandlerFallback(callback: (collect: string, params: IParams, flag: number) => void): void {
    this._csiHandlerFb = callback;
  }

  setEscHandler(collectAndFlag: string, callback: () => void): void {
    this._escHandlers[collectAndFlag] = callback;
  }
  clearEscHandler(collectAndFlag: string): void {
    if (this._escHandlers[collectAndFlag]) delete this._escHandlers[collectAndFlag];
  }
  setEscHandlerFallback(callback: (collect: string, flag: number) => void): void {
    this._escHandlerFb = callback;
  }

  addOscHandler(ident: number, callback: (data: string) => boolean): IDisposable {
    if (this._oscHandlers[ident] === undefined) {
      this._oscHandlers[ident] = [];
    }
    const handlerList = this._oscHandlers[ident];
    handlerList.push(callback);
    return {
      dispose: () => {
        const handlerIndex = handlerList.indexOf(callback);
        if (handlerIndex !== -1) {
          handlerList.splice(handlerIndex, 1);
        }
      }
    };
  }
  setOscHandler(ident: number, callback: (data: string) => void): void {
    this._oscHandlers[ident] = [callback];
  }
  clearOscHandler(ident: number): void {
    if (this._oscHandlers[ident]) delete this._oscHandlers[ident];
  }
  setOscHandlerFallback(callback: (identifier: number, data: string) => void): void {
    this._oscHandlerFb = callback;
  }

  setDcsHandler(collectAndFlag: string, handler: IDcsHandler): void {
    this._dcsHandlers[collectAndFlag] = handler;
  }
  clearDcsHandler(collectAndFlag: string): void {
    if (this._dcsHandlers[collectAndFlag]) delete this._dcsHandlers[collectAndFlag];
  }
  setDcsHandlerFallback(handler: IDcsHandler): void {
    this._dcsHandlerFb = handler;
  }

  setErrorHandler(callback: (state: IParsingState) => IParsingState): void {
    this._errorHandler = callback;
  }
  clearErrorHandler(): void {
    this._errorHandler = this._errorHandlerFb;
  }

  reset(): void {
    this.currentState = this.initialState;
    this._osc = '';
    this._params.reset();
    this._params.addParam(0); // ZDM
    this._collect = '';
    this._activeDcsHandler = null;
    this.precedingCodepoint = 0;
  }

  /**
   * Parse UTF32 codepoints in `data` up to `length`.
   *
   * Note: For several actions with high data load the parsing is optimized
   * by using local read ahead loops with hardcoded conditions to
   * avoid costly table lookups. Make sure that any change of table values
   * will be reflected in the loop conditions as well and vice versa.
   * Affected states/actions:
   * - GROUND:PRINT
   * - CSI_PARAM:PARAM
   * - DCS_PARAM:PARAM
   * - OSC_STRING:OSC_PUT
   * - DCS_PASSTHROUGH:DCS_PUT
   */
  parse(data: Uint32Array, length: number): void {
    let code = 0;
    let transition = 0;
    let currentState = this.currentState;
    let osc = this._osc;
    let collect = this._collect;
    const params = this._params;
    const table: Uint8Array = this.TRANSITIONS.table;
    let dcsHandler: IDcsHandler | null = this._activeDcsHandler;
    let callback: Function | null = null;

    // process input string
    for (let i = 0; i < length; ++i) {
      code = data[i];

      // normal transition & action lookup
      transition = table[currentState << TableAccess.INDEX_STATE_SHIFT | (code < 0xa0 ? code : NON_ASCII_PRINTABLE)];
      switch (transition >> TableAccess.TRANSITION_ACTION_SHIFT) {
        case ParserAction.PRINT:
          // read ahead with loop unrolling
          // Note: 0x20 (SP) is included, 0x7F (DEL) is excluded
          for (let j = i + 1; ; ++j) {
            if (j >= length || (code = data[j]) < 0x20 || (code > 0x7e && code < NON_ASCII_PRINTABLE)) {
              this._printHandler(data, i, j);
              i = j - 1;
              break;
            }
            if (++j >= length || (code = data[j]) < 0x20 || (code > 0x7e && code < NON_ASCII_PRINTABLE)) {
              this._printHandler(data, i, j);
              i = j - 1;
              break;
            }
            if (++j >= length || (code = data[j]) < 0x20 || (code > 0x7e && code < NON_ASCII_PRINTABLE)) {
              this._printHandler(data, i, j);
              i = j - 1;
              break;
            }
            if (++j >= length || (code = data[j]) < 0x20 || (code > 0x7e && code < NON_ASCII_PRINTABLE)) {
              this._printHandler(data, i, j);
              i = j - 1;
              break;
            }
          }
          break;
        case ParserAction.EXECUTE:
          this.precedingCodepoint = 0;
          callback = this._executeHandlers[code];
          if (callback) callback();
          else this._executeHandlerFb(code);
          break;
        case ParserAction.IGNORE:
          break;
        case ParserAction.ERROR:
          const inject: IParsingState = this._errorHandler(
            {
              position: i,
              code,
              currentState,
              osc,
              collect,
              params,
              abort: false
            });
          if (inject.abort) return;
          // inject values: currently not implemented
          break;
        case ParserAction.CSI_DISPATCH:
          // dont reset preceding codepoint for REP itself
          if (code !== 98) { // 'b'
            this.precedingCodepoint = 0;
          }
          // Trigger CSI Handler
          const handlers = this._csiHandlers[code];
          let j = handlers ? handlers.length - 1 : -1;
          for (; j >= 0; j--) {
            // undefined or true means success and to stop bubbling
            if (handlers[j](params, collect) !== false) {
              break;
            }
          }
          if (j < 0) {
            this._csiHandlerFb(collect, params, code);
          }
          break;
        case ParserAction.PARAM:
          // inner loop: digits (0x30 - 0x39) and ; (0x3b) and : (0x3a)
          let isSub = false;
          do {
            switch (code) {
              case 0x3b:
                params.addParam(0);  // ZDM
                isSub = false;
                break;
              case 0x3a:
                params.addSubParam(-1);
                isSub = true;
                break;
              default:  // 0x30 - 0x39
                if (isSub) params.addSubParamDigit(code - 48);
                else params.addParamDigit(code - 48);
            }
          } while (++i < length && (code = data[i]) > 0x2f && code < 0x3c);
          i--;
          break;
        case ParserAction.COLLECT:
          collect += String.fromCharCode(code);
          break;
        case ParserAction.ESC_DISPATCH:
          this.precedingCodepoint = 0;
          callback = this._escHandlers[collect + String.fromCharCode(code)];
          if (callback) callback(collect, code);
          else this._escHandlerFb(collect, code);
          break;
        case ParserAction.CLEAR:
          osc = '';
          params.reset();
          params.addParam(0); // ZDM
          collect = '';
          break;
        case ParserAction.DCS_HOOK:
          this.precedingCodepoint = 0;
          dcsHandler = this._dcsHandlers[collect + String.fromCharCode(code)];
          if (!dcsHandler) dcsHandler = this._dcsHandlerFb;
          dcsHandler.hook(collect, params, code);
          break;
        case ParserAction.DCS_PUT:
          // inner loop - exit DCS_PUT: 0x18, 0x1a, 0x1b, 0x7f, 0x80 - 0x9f
          // unhook triggered by: 0x1b, 0x9c
          for (let j = i + 1; ; ++j) {
            if (j >= length || (code = data[j]) === 0x18 || code === 0x1a || code === 0x1b || (code > 0x7f && code < NON_ASCII_PRINTABLE)) {
              if (dcsHandler) {
                dcsHandler.put(data, i, j);
              }
              i = j - 1;
              break;
            }
          }
          break;
        case ParserAction.DCS_UNHOOK:
          if (dcsHandler) {
            dcsHandler.unhook();
            dcsHandler = null;
          }
          if (code === 0x1b) transition |= ParserState.ESCAPE;
          osc = '';
          params.reset();
          params.addParam(0); // ZDM
          collect = '';
          break;
        case ParserAction.OSC_START:
          osc = '';
          break;
        case ParserAction.OSC_PUT:
          // inner loop: 0x20 (SP) included, 0x7F (DEL) included
          for (let j = i + 1; ; j++) {
            if (j >= length || (code = data[j]) < 0x20 || (code > 0x7f && code <= 0x9f)) {
              osc += utf32ToString(data, i, j);
              i = j - 1;
              break;
            }
          }
          break;
        case ParserAction.OSC_END:
          this.precedingCodepoint = 0;
          if (osc && code !== 0x18 && code !== 0x1a) {
            // NOTE: OSC subparsing is not part of the original parser
            // we do basic identifier parsing here to offer a jump table for OSC as well
            const idx = osc.indexOf(';');
            if (idx === -1) {
              this._oscHandlerFb(-1, osc);  // this is an error (malformed OSC)
            } else {
              // Note: NaN is not handled here
              // either catch it with the fallback handler
              // or with an explicit NaN OSC handler
              const identifier = parseInt(osc.substring(0, idx));
              const content = osc.substring(idx + 1);
              // Trigger OSC Handler
              const handlers = this._oscHandlers[identifier];
              let j = handlers ? handlers.length - 1 : -1;
              for (; j >= 0; j--) {
                // undefined or true means success and to stop bubbling
                if (handlers[j](content) !== false) {
                  break;
                }
              }
              if (j < 0) {
                this._oscHandlerFb(identifier, content);
              }
            }
          }
          if (code === 0x1b) transition |= ParserState.ESCAPE;
          osc = '';
          params.reset();
          params.addParam(0); // ZDM
          collect = '';
          break;
      }
      currentState = transition & TableAccess.TRANSITION_STATE_MASK;
    }

    // save non pushable buffers
    this._osc = osc;
    this._collect = collect;
    this._params = params;

    // save active dcs handler reference
    this._activeDcsHandler = dcsHandler;

    // save state
    this.currentState = currentState;
  }
}
