/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */
import { assert } from 'chai';
import { OscParser, OscHandler } from 'common/parser/OscParser';
import { StringToUtf32, utf32ToString } from 'common/input/TextDecoder';
import { IOscHandler } from 'common/parser/Types';
import { PAYLOAD_LIMIT } from 'common/parser/Constants';

function toUtf32(s: string): Uint32Array {
  const utf32 = new Uint32Array(s.length);
  const decoder = new StringToUtf32();
  const length = decoder.decode(s, utf32);
  return utf32.subarray(0, length);
}

class TestHandler implements IOscHandler {
  constructor(public id: number, public output: any[], public msg: string, public returnFalse: boolean = false) {}
  public start(): void {
    this.output.push([this.msg, this.id, 'START']);
  }
  public put(data: Uint32Array, start: number, end: number): void {
    this.output.push([this.msg, this.id, 'PUT', utf32ToString(data, start, end)]);
  }
  public end(success: boolean): void | boolean {
    this.output.push([this.msg, this.id, 'END', success]);
    if (this.returnFalse) {
      return false;
    }
  }
}

describe('OscParser', () => {
  let parser: OscParser;
  let reports: any[] = [];
  beforeEach(() => {
    reports = [];
    parser = new OscParser();
    parser.setHandlerFallback((id, action, data) => {
      reports.push([id, action, data]);
    });
  });
  describe('identifier parsing', () => {
    it('no report for illegal ids', () => {
      const data = toUtf32('hello world!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, []);
    });
    it('no payload', () => {
      parser.start();
      let data = toUtf32('12');
      parser.put(data, 0, data.length);
      data = toUtf32('34');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [[1234, 'START', undefined], [1234, 'END', true]]);
    });
    it('with payload', () => {
      parser.start();
      let data = toUtf32('12');
      parser.put(data, 0, data.length);
      data = toUtf32('34');
      parser.put(data, 0, data.length);
      data = toUtf32(';h');
      parser.put(data, 0, data.length);
      data = toUtf32('ello');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        [1234, 'START', undefined],
        [1234, 'PUT', 'h'],
        [1234, 'PUT', 'ello'],
        [1234, 'END', true]
      ]);
    });
  });
  describe('handler registration', () => {
    it('setOscHandler', () => {
      parser.setHandler(1234, new TestHandler(1234, reports, 'th'));
      parser.start();
      let data = toUtf32('1234;Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        // messages from TestHandler
        ['th', 1234, 'START'],
        ['th', 1234, 'PUT', 'Here comes'],
        ['th', 1234, 'PUT', 'the mouse!'],
        ['th', 1234, 'END', true]
      ]);
    });
    it('clearOscHandler', () => {
      parser.setHandler(1234, new TestHandler(1234, reports, 'th'));
      parser.clearHandler(1234);
      parser.start();
      let data = toUtf32('1234;Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        // messages from fallback handler
        [1234, 'START', undefined],
        [1234, 'PUT', 'Here comes'],
        [1234, 'PUT', 'the mouse!'],
        [1234, 'END', true]
      ]);
    });
    it('addOscHandler', () => {
      parser.setHandler(1234, new TestHandler(1234, reports, 'th1'));
      parser.addHandler(1234, new TestHandler(1234, reports, 'th2'));
      parser.start();
      let data = toUtf32('1234;Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        ['th2', 1234, 'START'],
        ['th1', 1234, 'START'],
        ['th2', 1234, 'PUT', 'Here comes'],
        ['th1', 1234, 'PUT', 'Here comes'],
        ['th2', 1234, 'PUT', 'the mouse!'],
        ['th1', 1234, 'PUT', 'the mouse!'],
        ['th2', 1234, 'END', true],
        ['th1', 1234, 'END', false]  // false due being already handled by th2!
      ]);
    });
    it('addOscHandler with return false', () => {
      parser.setHandler(1234, new TestHandler(1234, reports, 'th1'));
      parser.addHandler(1234, new TestHandler(1234, reports, 'th2', true));
      parser.start();
      let data = toUtf32('1234;Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        ['th2', 1234, 'START'],
        ['th1', 1234, 'START'],
        ['th2', 1234, 'PUT', 'Here comes'],
        ['th1', 1234, 'PUT', 'Here comes'],
        ['th2', 1234, 'PUT', 'the mouse!'],
        ['th1', 1234, 'PUT', 'the mouse!'],
        ['th2', 1234, 'END', true],
        ['th1', 1234, 'END', true]  // true since th2 indicated to keep bubbling
      ]);
    });
    it('dispose handlers', () => {
      parser.setHandler(1234, new TestHandler(1234, reports, 'th1'));
      const dispo = parser.addHandler(1234, new TestHandler(1234, reports, 'th2', true));
      dispo.dispose();
      parser.start();
      let data = toUtf32('1234;Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32('the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [
        ['th1', 1234, 'START'],
        ['th1', 1234, 'PUT', 'Here comes'],
        ['th1', 1234, 'PUT', 'the mouse!'],
        ['th1', 1234, 'END', true]
      ]);
    });
  });
  describe('OscHandlerFactory', () => {
    it('should be called once on end(true)', () => {
      parser.setHandler(1234, new OscHandler(data => reports.push([1234, data])));
      parser.start();
      let data = toUtf32('1234;Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [[1234, 'Here comes the mouse!']]);
    });
    it('should not be called on end(false)', () => {
      parser.setHandler(1234, new OscHandler(data => reports.push([1234, data])));
      parser.start();
      let data = toUtf32('1234;Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.end(false);
      assert.deepEqual(reports, []);
    });
    it('should be disposable', () => {
      parser.setHandler(1234, new OscHandler(data => reports.push(['one', data])));
      const dispo = parser.addHandler(1234, new OscHandler(data => reports.push(['two', data])));
      parser.start();
      let data = toUtf32('1234;Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [['two', 'Here comes the mouse!']]);
      dispo.dispose();
      parser.start();
      data = toUtf32('1234;some other');
      parser.put(data, 0, data.length);
      data = toUtf32(' data');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [['two', 'Here comes the mouse!'], ['one', 'some other data']]);
    });
    it('should respect return false', () => {
      parser.setHandler(1234, new OscHandler(data => reports.push(['one', data])));
      parser.addHandler(1234, new OscHandler(data => { reports.push(['two', data]); return false; }));
      parser.start();
      let data = toUtf32('1234;Here comes');
      parser.put(data, 0, data.length);
      data = toUtf32(' the mouse!');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, [['two', 'Here comes the mouse!'], ['one', 'Here comes the mouse!']]);
    });
    it('should work up to payload limit', function(): void {
      this.timeout(10000);
      parser.setHandler(1234, new OscHandler(data => reports.push([1234, data])));
      parser.start();
      let data = toUtf32('1234;');
      parser.put(data, 0, data.length);
      data = toUtf32('A'.repeat(1000));
      for (let i = 0; i < PAYLOAD_LIMIT; i += 1000) {
        parser.put(data, 0, data.length);
      }
      parser.end(true);
      assert.deepEqual(reports, [[1234, 'A'.repeat(PAYLOAD_LIMIT)]]);
    });
    it('should abort for payload limit +1', function(): void {
      this.timeout(10000);
      parser.setHandler(1234, new OscHandler(data => reports.push([1234, data])));
      parser.start();
      let data = toUtf32('1234;');
      parser.put(data, 0, data.length);
      data = toUtf32('A'.repeat(1000));
      for (let i = 0; i < PAYLOAD_LIMIT; i += 1000) {
        parser.put(data, 0, data.length);
      }
      data = toUtf32('A');
      parser.put(data, 0, data.length);
      parser.end(true);
      assert.deepEqual(reports, []);
    });
  });
});
