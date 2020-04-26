/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { DcsParser, DcsHandler } from 'common/parser/DcsParser';
import { IDcsHandler, IParams, IFunctionIdentifier } from 'common/parser/Types';
import { utf32ToString, StringToUtf32 } from 'common/input/TextDecoder';
import { Params } from 'common/parser/Params';
import { PAYLOAD_LIMIT } from 'common/parser/Constants';

function toUtf32(s: string): Uint32Array {
  const utf32 = new Uint32Array(s.length);
  const decoder = new StringToUtf32();
  const length = decoder.decode(s, utf32);
  return utf32.subarray(0, length);
}

function identifier(id: IFunctionIdentifier): number {
  let res = 0;
  if (id.prefix) {
    if (id.prefix.length > 1) {
      throw new Error('only one byte as prefix supported');
    }
    res = id.prefix.charCodeAt(0);
    if (res && 0x3c > res || res > 0x3f) {
      throw new Error('prefix must be in range 0x3c .. 0x3f');
    }
  }
  if (id.intermediates) {
    if (id.intermediates.length > 2) {
      throw new Error('only two bytes as intermediates are supported');
    }
    for (let i = 0; i < id.intermediates.length; ++i) {
      const intermediate = id.intermediates.charCodeAt(i);
      if (0x20 > intermediate || intermediate > 0x2f) {
        throw new Error('intermediate must be in range 0x20 .. 0x2f');
      }
      res <<= 8;
      res |= intermediate;
    }
  }
  if (id.final.length !== 1) {
    throw new Error('final must be a single byte');
  }
  const finalCode = id.final.charCodeAt(0);
  if (0x40 > finalCode || finalCode > 0x7e) {
    throw new Error('final must be in range 0x40 .. 0x7e');
  }
  res <<= 8;
  res |= finalCode;

  return res;
}

class TestHandler implements IDcsHandler {
  constructor(public output: any[], public msg: string, public returnFalse: boolean = false) {}
  public hook(params: IParams): void {
    this.output.push([this.msg, 'HOOK', params.toArray()]);
  }
  public put(data: Uint32Array, start: number, end: number): void {
    this.output.push([this.msg, 'PUT', utf32ToString(data, start, end)]);
  }
  public unhook(success: boolean): void | boolean {
    this.output.push([this.msg, 'UNHOOK', success]);
    if (this.returnFalse) {
      return false;
    }
  }
}

describe('DcsParser', () => {
  let parser: DcsParser;
  let reports: any[] = [];
  beforeEach(() => {
    reports = [];
    parser = new DcsParser();
    parser.setHandlerFallback((id, action, data) => {
      if (action === 'HOOK') {
        data = data.toArray();
      }
      reports.push([id, action, data]);
    });
  });
  describe('handler registration', () => {
    it('setDcsHandler', () => {
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th'));
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [
        // messages from TestHandler
        ['th', 'HOOK', [1, 2, 3]],
        ['th', 'PUT', 'Here comes'],
        ['th', 'PUT', 'the mouse!'],
        ['th', 'UNHOOK', true]
      ]);
    });
    it('clearDcsHandler', () => {
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th'));
      parser.clearHandler(identifier({intermediates: '+', final: 'p'}));
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [
        // messages from fallback handler
        [identifier({intermediates: '+', final: 'p'}), 'HOOK', [1, 2, 3]],
        [identifier({intermediates: '+', final: 'p'}), 'PUT', 'Here comes'],
        [identifier({intermediates: '+', final: 'p'}), 'PUT', 'the mouse!'],
        [identifier({intermediates: '+', final: 'p'}), 'UNHOOK', true]
      ]);
    });
    it('addDcsHandler', () => {
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th1'));
      parser.addHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th2'));
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [
        ['th2', 'HOOK', [1, 2, 3]],
        ['th1', 'HOOK', [1, 2, 3]],
        ['th2', 'PUT', 'Here comes'],
        ['th1', 'PUT', 'Here comes'],
        ['th2', 'PUT', 'the mouse!'],
        ['th1', 'PUT', 'the mouse!'],
        ['th2', 'UNHOOK', true],
        ['th1', 'UNHOOK', false]  // false due being already handled by th2!
      ]);
    });
    it('addDcsHandler with return false', () => {
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th1'));
      parser.addHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th2', true));
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [
        ['th2', 'HOOK', [1, 2, 3]],
        ['th1', 'HOOK', [1, 2, 3]],
        ['th2', 'PUT', 'Here comes'],
        ['th1', 'PUT', 'Here comes'],
        ['th2', 'PUT', 'the mouse!'],
        ['th1', 'PUT', 'the mouse!'],
        ['th2', 'UNHOOK', true],
        ['th1', 'UNHOOK', true]  // true since th2 indicated to keep bubbling
      ]);
    });
    it('dispose handlers', () => {
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th1'));
      const dispo = parser.addHandler(identifier({intermediates: '+', final: 'p'}), new TestHandler(reports, 'th2', true));
      dispo.dispose();
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [
        ['th1', 'HOOK', [1, 2, 3]],
        ['th1', 'PUT', 'Here comes'],
        ['th1', 'PUT', 'the mouse!'],
        ['th1', 'UNHOOK', true]
      ]);
    });
  });
  describe('DcsHandlerFactory', () => {
    it('should be called once on end(true)', () => {
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new DcsHandler((data, params) => reports.push([params.toArray(), data])));
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [[[1, 2, 3], 'Here comes the mouse!']]);
    });
    it('should not be called on end(false)', () => {
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new DcsHandler((data, params) => reports.push([params.toArray(), data])));
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(false);
      assert.deepEqual(reports, []);
    });
    it('should be disposable', () => {
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new DcsHandler((data, params) => reports.push(['one', params.toArray(), data])));
      const dispo = parser.addHandler(identifier({intermediates: '+', final: 'p'}), new DcsHandler((data, params) => reports.push(['two', params.toArray(), data])));
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [['two', [1, 2, 3], 'Here comes the mouse!']]);
      dispo.dispose();
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      data = toUtf32('some other');
      parser.put(data, 0, data.length);
      data = toUtf32(' data');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [['two', [1, 2, 3], 'Here comes the mouse!'], ['one', [1, 2, 3], 'some other data']]);
    });
    it('should respect return false', () => {
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new DcsHandler((data, params) => reports.push(['one', params.toArray(), data])));
      parser.addHandler(identifier({intermediates: '+', final: 'p'}), new DcsHandler((data, params) => { reports.push(['two', params.toArray(), data]); return false; }));
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      let data = toUtf32('Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, [['two', [1, 2, 3], 'Here comes the mouse!'], ['one', [1, 2, 3], 'Here comes the mouse!']]);
    });
    it('should work up to payload limit', function(): void {
      this.timeout(10000);
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new DcsHandler((data, params) => reports.push([params.toArray(), data])));
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      const data = toUtf32('A'.repeat(1000));
      for (let i = 0; i < PAYLOAD_LIMIT; i += 1000) {
        parser.put(data, 0, data.length);
      }
      parser.unhook(true);
      assert.deepEqual(reports, [[[1, 2, 3], 'A'.repeat(PAYLOAD_LIMIT)]]);
    });
    it('should abort for payload limit +1', function(): void {
      this.timeout(10000);
      parser.setHandler(identifier({intermediates: '+', final: 'p'}), new DcsHandler((data, params) => reports.push([params.toArray(), data])));
      parser.hook(identifier({intermediates: '+', final: 'p'}), Params.fromArray([1, 2, 3]));
      let data = toUtf32('A'.repeat(1000));
      for (let i = 0; i < PAYLOAD_LIMIT; i += 1000) {
        parser.put(data, 0, data.length);
      }
      data = toUtf32('A');
      parser.put(data, 0, data.length);
      parser.unhook(true);
      assert.deepEqual(reports, []);
    });
  });
});
