/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';
import { InputHandler } from './InputHandler';
import { MockInputHandlingTerminal, TestTerminal } from './TestUtils.test';
import { Terminal } from './Terminal';
import { IBufferLine, IAttributeData } from 'common/Types';
import { DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { CellData } from 'common/buffer/CellData';
import { Attributes, UnderlineStyle } from 'common/buffer/Constants';
import { AttributeData } from 'common/buffer/AttributeData';
import { Params } from 'common/parser/Params';
import { MockCoreService, MockBufferService, MockDirtyRowService, MockOptionsService, MockLogService, MockCoreMouseService, MockCharsetService, MockUnicodeService } from 'common/TestUtils.test';
import { IBufferService } from 'common/services/Services';
import { DEFAULT_OPTIONS } from 'common/services/OptionsService';
import { clone } from 'common/Clone';

function getCursor(term: TestTerminal): number[] {
  return [
    term.buffer.x,
    term.buffer.y
  ];
}

function getLines(term: TestTerminal, limit: number = term.rows): string[] {
  const res: string[] = [];
  for (let i = 0; i < limit; ++i) {
    res.push(term.buffer.lines.get(i).translateToString(true));
  }
  return res;
}

class TestInputHandler extends InputHandler {
  get curAttrData(): IAttributeData { return (this as any)._curAttrData; }
}

describe('InputHandler', () => {
  describe('save and restore cursor', () => {
    const terminal = new MockInputHandlingTerminal();
    const bufferService = new MockBufferService(80, 30);
    bufferService.buffer.x = 1;
    bufferService.buffer.y = 2;
    bufferService.buffer.ybase = 0;
    const inputHandler = new TestInputHandler(terminal, bufferService, new MockCharsetService(), new MockCoreService(), new MockDirtyRowService(), new MockLogService(), new MockOptionsService(), new MockCoreMouseService(), new MockUnicodeService(), {} as any);
    inputHandler.curAttrData.fg = 3;
    // Save cursor position
    inputHandler.saveCursor();
    assert.equal(bufferService.buffer.x, 1);
    assert.equal(bufferService.buffer.y, 2);
    assert.equal(inputHandler.curAttrData.fg, 3);
    // Change cursor position
    bufferService.buffer.x = 10;
    bufferService.buffer.y = 20;
    inputHandler.curAttrData.fg = 30;
    // Restore cursor position
    inputHandler.restoreCursor();
    assert.equal(bufferService.buffer.x, 1);
    assert.equal(bufferService.buffer.y, 2);
    assert.equal(inputHandler.curAttrData.fg, 3);
  });
  describe('setCursorStyle', () => {
    it('should call Terminal.setOption with correct params', () => {
      const optionsService = new MockOptionsService();
      const inputHandler = new InputHandler(new MockInputHandlingTerminal(), new MockBufferService(80, 30), new MockCharsetService(), new MockCoreService(), new MockDirtyRowService(), new MockLogService(), optionsService, new MockCoreMouseService(), new MockUnicodeService(), {} as any);

      inputHandler.setCursorStyle(Params.fromArray([0]));
      assert.equal(optionsService.options['cursorStyle'], 'block');
      assert.equal(optionsService.options['cursorBlink'], true);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([1]));
      assert.equal(optionsService.options['cursorStyle'], 'block');
      assert.equal(optionsService.options['cursorBlink'], true);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([2]));
      assert.equal(optionsService.options['cursorStyle'], 'block');
      assert.equal(optionsService.options['cursorBlink'], false);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([3]));
      assert.equal(optionsService.options['cursorStyle'], 'underline');
      assert.equal(optionsService.options['cursorBlink'], true);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([4]));
      assert.equal(optionsService.options['cursorStyle'], 'underline');
      assert.equal(optionsService.options['cursorBlink'], false);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([5]));
      assert.equal(optionsService.options['cursorStyle'], 'bar');
      assert.equal(optionsService.options['cursorBlink'], true);

      optionsService.options = clone(DEFAULT_OPTIONS);
      inputHandler.setCursorStyle(Params.fromArray([6]));
      assert.equal(optionsService.options['cursorStyle'], 'bar');
      assert.equal(optionsService.options['cursorBlink'], false);
    });
  });
  describe('setMode', () => {
    it('should toggle Terminal.bracketedPasteMode', () => {
      const terminal = new MockInputHandlingTerminal();
      terminal.bracketedPasteMode = false;
      const inputHandler = new InputHandler(terminal, new MockBufferService(80, 30), new MockCharsetService(), new MockCoreService(), new MockDirtyRowService(), new MockLogService(), new MockOptionsService(), new MockCoreMouseService(), new MockUnicodeService(), {} as any);
      // Set bracketed paste mode
      inputHandler.setModePrivate(Params.fromArray([2004]));
      assert.equal(terminal.bracketedPasteMode, true);
      // Reset bracketed paste mode
      inputHandler.resetModePrivate(Params.fromArray([2004]));
      assert.equal(terminal.bracketedPasteMode, false);
    });
  });
  describe('regression tests', function(): void {
    function termContent(bufferService: IBufferService, trim: boolean): string[] {
      const result = [];
      for (let i = 0; i < bufferService.rows; ++i) result.push(bufferService.buffer.lines.get(i).translateToString(trim));
      return result;
    }

    it('insertChars', function(): void {
      const term = new Terminal();
      const bufferService = new MockBufferService(80, 30);
      const inputHandler = new InputHandler(term, bufferService, new MockCharsetService(), new MockCoreService(), new MockDirtyRowService(), new MockLogService(), new MockOptionsService(), new MockCoreMouseService(), new MockUnicodeService(), {} as any);

      // insert some data in first and second line
      inputHandler.parse(Array(bufferService.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      inputHandler.parse(Array(bufferService.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      const line1: IBufferLine = bufferService.buffer.lines.get(0);
      expect(line1.translateToString(false)).equals(Array(bufferService.cols - 9).join('a') + '1234567890');

      // insert one char from params = [0]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([0]));
      expect(line1.translateToString(false)).equals(Array(bufferService.cols - 9).join('a') + ' 123456789');

      // insert one char from params = [1]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([1]));
      expect(line1.translateToString(false)).equals(Array(bufferService.cols - 9).join('a') + '  12345678');

      // insert two chars from params = [2]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([2]));
      expect(line1.translateToString(false)).equals(Array(bufferService.cols - 9).join('a') + '    123456');

      // insert 10 chars from params = [10]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.insertChars(Params.fromArray([10]));
      expect(line1.translateToString(false)).equals(Array(bufferService.cols - 9).join('a') + '          ');
      expect(line1.translateToString(true)).equals(Array(bufferService.cols - 9).join('a'));
    });
    it('deleteChars', function(): void {
      const term = new Terminal();
      const bufferService = new MockBufferService(80, 30);
      const inputHandler = new InputHandler(term, bufferService, new MockCharsetService(), new MockCoreService(), new MockDirtyRowService(), new MockLogService(), new MockOptionsService(), new MockCoreMouseService(), new MockUnicodeService(), {} as any);

      // insert some data in first and second line
      inputHandler.parse(Array(bufferService.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      inputHandler.parse(Array(bufferService.cols - 9).join('a'));
      inputHandler.parse('1234567890');
      const line1: IBufferLine = bufferService.buffer.lines.get(0);
      expect(line1.translateToString(false)).equals(Array(bufferService.cols - 9).join('a') + '1234567890');

      // delete one char from params = [0]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([0]));
      expect(line1.translateToString(false)).equals(Array(bufferService.cols - 9).join('a') + '234567890 ');
      expect(line1.translateToString(true)).equals(Array(bufferService.cols - 9).join('a') + '234567890');

      // insert one char from params = [1]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([1]));
      expect(line1.translateToString(false)).equals(Array(bufferService.cols - 9).join('a') + '34567890  ');
      expect(line1.translateToString(true)).equals(Array(bufferService.cols - 9).join('a') + '34567890');

      // insert two chars from params = [2]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([2]));
      expect(line1.translateToString(false)).equals(Array(bufferService.cols - 9).join('a') + '567890    ');
      expect(line1.translateToString(true)).equals(Array(bufferService.cols - 9).join('a') + '567890');

      // insert 10 chars from params = [10]
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.deleteChars(Params.fromArray([10]));
      expect(line1.translateToString(false)).equals(Array(bufferService.cols - 9).join('a') + '          ');
      expect(line1.translateToString(true)).equals(Array(bufferService.cols - 9).join('a'));
    });
    it('eraseInLine', function(): void {
      const term = new Terminal();
      const bufferService = new MockBufferService(80, 30);
      const inputHandler = new InputHandler(term, bufferService, new MockCharsetService(), new MockCoreService(), new MockDirtyRowService(), new MockLogService(), new MockOptionsService(), new MockCoreMouseService(), new MockUnicodeService(), {} as any);

      // fill 6 lines to test 3 different states
      inputHandler.parse(Array(bufferService.cols + 1).join('a'));
      inputHandler.parse(Array(bufferService.cols + 1).join('a'));
      inputHandler.parse(Array(bufferService.cols + 1).join('a'));

      // params[0] - right erase
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 70;
      inputHandler.eraseInLine(Params.fromArray([0]));
      expect(bufferService.buffer.lines.get(0).translateToString(false)).equals(Array(71).join('a') + '          ');

      // params[1] - left erase
      bufferService.buffer.y = 1;
      bufferService.buffer.x = 70;
      inputHandler.eraseInLine(Params.fromArray([1]));
      expect(bufferService.buffer.lines.get(1).translateToString(false)).equals(Array(71).join(' ') + ' aaaaaaaaa');

      // params[1] - left erase
      bufferService.buffer.y = 2;
      bufferService.buffer.x = 70;
      inputHandler.eraseInLine(Params.fromArray([2]));
      expect(bufferService.buffer.lines.get(2).translateToString(false)).equals(Array(bufferService.cols + 1).join(' '));

    });
    it('eraseInDisplay', function(): void {
      const term = new Terminal({cols: 80, rows: 7});
      const bufferService = new MockBufferService(80, 7);
      const inputHandler = new InputHandler(term, bufferService, new MockCharsetService(), new MockCoreService(), new MockDirtyRowService(), new MockLogService(), new MockOptionsService(), new MockCoreMouseService(), new MockUnicodeService(), {} as any);

      // fill display with a's
      for (let i = 0; i < bufferService.rows; ++i) inputHandler.parse(Array(bufferService.cols + 1).join('a'));

      // params [0] - right and below erase
      bufferService.buffer.y = 5;
      bufferService.buffer.x = 40;
      inputHandler.eraseInDisplay(Params.fromArray([0]));
      expect(termContent(bufferService, false)).eql([
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(40 + 1).join('a') + Array(bufferService.cols - 40 + 1).join(' '),
        Array(bufferService.cols + 1).join(' ')
      ]);
      expect(termContent(bufferService, true)).eql([
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(bufferService.cols + 1).join('a'),
        Array(40 + 1).join('a'),
        ''
      ]);

      // reset
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 0;
      for (let i = 0; i < bufferService.rows; ++i) inputHandler.parse(Array(bufferService.cols + 1).join('a'));

      // params [1] - left and above
      bufferService.buffer.y = 5;
      bufferService.buffer.x = 40;
      inputHandler.eraseInDisplay(Params.fromArray([1]));
      expect(termContent(bufferService, false)).eql([
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(41 + 1).join(' ') + Array(bufferService.cols - 41 + 1).join('a'),
        Array(bufferService.cols + 1).join('a')
      ]);
      expect(termContent(bufferService, true)).eql([
        '',
        '',
        '',
        '',
        '',
        Array(41 + 1).join(' ') + Array(bufferService.cols - 41 + 1).join('a'),
        Array(bufferService.cols + 1).join('a')
      ]);

      // reset
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 0;
      for (let i = 0; i < bufferService.rows; ++i) inputHandler.parse(Array(bufferService.cols + 1).join('a'));

      // params [2] - whole screen
      bufferService.buffer.y = 5;
      bufferService.buffer.x = 40;
      inputHandler.eraseInDisplay(Params.fromArray([2]));
      expect(termContent(bufferService, false)).eql([
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' '),
        Array(bufferService.cols + 1).join(' ')
      ]);
      expect(termContent(bufferService, true)).eql([
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ]);

      // reset and add a wrapped line
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 0;
      inputHandler.parse(Array(bufferService.cols + 1).join('a')); // line 0
      inputHandler.parse(Array(bufferService.cols + 10).join('a')); // line 1 and 2
      for (let i = 3; i < bufferService.rows; ++i) inputHandler.parse(Array(bufferService.cols + 1).join('a'));

      // params[1] left and above with wrap
      // confirm precondition that line 2 is wrapped
      expect(bufferService.buffer.lines.get(2).isWrapped).true;
      bufferService.buffer.y = 2;
      bufferService.buffer.x = 40;
      inputHandler.eraseInDisplay(Params.fromArray([1]));
      expect(bufferService.buffer.lines.get(2).isWrapped).false;

      // reset and add a wrapped line
      bufferService.buffer.y = 0;
      bufferService.buffer.x = 0;
      inputHandler.parse(Array(bufferService.cols + 1).join('a')); // line 0
      inputHandler.parse(Array(bufferService.cols + 10).join('a')); // line 1 and 2
      for (let i = 3; i < bufferService.rows; ++i) inputHandler.parse(Array(bufferService.cols + 1).join('a'));

      // params[1] left and above with wrap
      // confirm precondition that line 2 is wrapped
      expect(bufferService.buffer.lines.get(2).isWrapped).true;
      bufferService.buffer.y = 1;
      bufferService.buffer.x = 90; // Cursor is beyond last column
      inputHandler.eraseInDisplay(Params.fromArray([1]));
      expect(bufferService.buffer.lines.get(2).isWrapped).false;
    });
  });
  it('convertEol setting', function(): void {
    // not converting
    const termNotConverting = new Terminal({cols: 15, rows: 10});
    (termNotConverting as any)._inputHandler.parse('Hello\nWorld');
    expect(termNotConverting.buffer.lines.get(0).translateToString(false)).equals('Hello          ');
    expect(termNotConverting.buffer.lines.get(1).translateToString(false)).equals('     World     ');
    expect(termNotConverting.buffer.lines.get(0).translateToString(true)).equals('Hello');
    expect(termNotConverting.buffer.lines.get(1).translateToString(true)).equals('     World');

    // converting
    const termConverting = new Terminal({cols: 15, rows: 10, convertEol: true});
    (termConverting as any)._inputHandler.parse('Hello\nWorld');
    expect(termConverting.buffer.lines.get(0).translateToString(false)).equals('Hello          ');
    expect(termConverting.buffer.lines.get(1).translateToString(false)).equals('World          ');
    expect(termConverting.buffer.lines.get(0).translateToString(true)).equals('Hello');
    expect(termConverting.buffer.lines.get(1).translateToString(true)).equals('World');
  });
  describe('print', () => {
    it('should not cause an infinite loop (regression test)', () => {
      const term = new Terminal();
      const inputHandler = new InputHandler(term, new MockBufferService(80, 30), new MockCharsetService(), new MockCoreService(), new MockDirtyRowService(), new MockLogService(), new MockOptionsService(), new MockCoreMouseService(), new MockUnicodeService(), {} as any);
      const container = new Uint32Array(10);
      container[0] = 0x200B;
      inputHandler.print(container, 0, 1);
    });
  });

  describe('alt screen', () => {
    let term: Terminal;
    let bufferService: IBufferService;
    let handler: InputHandler;

    beforeEach(() => {
      term = new Terminal();
      bufferService = new MockBufferService(80, 30);
      handler = new InputHandler(term, bufferService, new MockCharsetService(), new MockCoreService(), new MockDirtyRowService(), new MockLogService(), new MockOptionsService(), new MockCoreMouseService(), new MockUnicodeService(), {} as any);
    });
    it('should handle DECSET/DECRST 47 (alt screen buffer)', () => {
      handler.parse('\x1b[?47h\r\n\x1b[31mJUNK\x1b[?47lTEST');
      expect(bufferService.buffer.translateBufferLineToString(0, true)).to.equal('');
      expect(bufferService.buffer.translateBufferLineToString(1, true)).to.equal('    TEST');
      // Text color of 'TEST' should be red
      expect((bufferService.buffer.lines.get(1).loadCell(4, new CellData()).getFgColor())).to.equal(1);
    });
    it('should handle DECSET/DECRST 1047 (alt screen buffer)', () => {
      handler.parse('\x1b[?1047h\r\n\x1b[31mJUNK\x1b[?1047lTEST');
      expect(bufferService.buffer.translateBufferLineToString(0, true)).to.equal('');
      expect(bufferService.buffer.translateBufferLineToString(1, true)).to.equal('    TEST');
      // Text color of 'TEST' should be red
      expect((bufferService.buffer.lines.get(1).loadCell(4, new CellData()).getFgColor())).to.equal(1);
    });
    it('should handle DECSET/DECRST 1048 (alt screen cursor)', () => {
      handler.parse('\x1b[?1048h\r\n\x1b[31mJUNK\x1b[?1048lTEST');
      expect(bufferService.buffer.translateBufferLineToString(0, true)).to.equal('TEST');
      expect(bufferService.buffer.translateBufferLineToString(1, true)).to.equal('JUNK');
      // Text color of 'TEST' should be default
      expect(bufferService.buffer.lines.get(0).loadCell(0, new CellData()).fg).to.equal(DEFAULT_ATTR_DATA.fg);
      // Text color of 'JUNK' should be red
      expect((bufferService.buffer.lines.get(1).loadCell(0, new CellData()).getFgColor())).to.equal(1);
    });
    it('should handle DECSET/DECRST 1049 (alt screen buffer+cursor)', () => {
      handler.parse('\x1b[?1049h\r\n\x1b[31mJUNK\x1b[?1049lTEST');
      expect(bufferService.buffer.translateBufferLineToString(0, true)).to.equal('TEST');
      expect(bufferService.buffer.translateBufferLineToString(1, true)).to.equal('');
      // Text color of 'TEST' should be default
      expect(bufferService.buffer.lines.get(0).loadCell(0, new CellData()).fg).to.equal(DEFAULT_ATTR_DATA.fg);
    });
    it('should handle DECSET/DECRST 1049 - maintains saved cursor for alt buffer', () => {
      handler.parse('\x1b[?1049h\r\n\x1b[31m\x1b[s\x1b[?1049lTEST');
      expect(bufferService.buffer.translateBufferLineToString(0, true)).to.equal('TEST');
      // Text color of 'TEST' should be default
      expect(bufferService.buffer.lines.get(0).loadCell(0, new CellData()).fg).to.equal(DEFAULT_ATTR_DATA.fg);
      handler.parse('\x1b[?1049h\x1b[uTEST');
      expect(bufferService.buffer.translateBufferLineToString(1, true)).to.equal('TEST');
      // Text color of 'TEST' should be red
      expect((bufferService.buffer.lines.get(1).loadCell(0, new CellData()).getFgColor())).to.equal(1);
    });
    it('should handle DECSET/DECRST 1049 - clears alt buffer with erase attributes', () => {
      handler.parse('\x1b[42m\x1b[?1049h');
      // Buffer should be filled with green background
      expect(bufferService.buffer.lines.get(20).loadCell(10, new CellData()).getBgColor()).to.equal(2);
    });
  });

  describe('text attributes', () => {
    let term: TestTerminal;
    beforeEach(() => {
      term = new TestTerminal();
    });
    it('bold', () => {
      term.writeSync('\x1b[1m');
      assert.equal(!!term.curAttrData.isBold(), true);
      term.writeSync('\x1b[22m');
      assert.equal(!!term.curAttrData.isBold(), false);
    });
    it('dim', () => {
      term.writeSync('\x1b[2m');
      assert.equal(!!term.curAttrData.isDim(), true);
      term.writeSync('\x1b[22m');
      assert.equal(!!term.curAttrData.isDim(), false);
    });
    it('italic', () => {
      term.writeSync('\x1b[3m');
      assert.equal(!!term.curAttrData.isItalic(), true);
      term.writeSync('\x1b[23m');
      assert.equal(!!term.curAttrData.isItalic(), false);
    });
    it('underline', () => {
      term.writeSync('\x1b[4m');
      assert.equal(!!term.curAttrData.isUnderline(), true);
      term.writeSync('\x1b[24m');
      assert.equal(!!term.curAttrData.isUnderline(), false);
    });
    it('blink', () => {
      term.writeSync('\x1b[5m');
      assert.equal(!!term.curAttrData.isBlink(), true);
      term.writeSync('\x1b[25m');
      assert.equal(!!term.curAttrData.isBlink(), false);
    });
    it('inverse', () => {
      term.writeSync('\x1b[7m');
      assert.equal(!!term.curAttrData.isInverse(), true);
      term.writeSync('\x1b[27m');
      assert.equal(!!term.curAttrData.isInverse(), false);
    });
    it('invisible', () => {
      term.writeSync('\x1b[8m');
      assert.equal(!!term.curAttrData.isInvisible(), true);
      term.writeSync('\x1b[28m');
      assert.equal(!!term.curAttrData.isInvisible(), false);
    });
    it('colormode palette 16', () => {
      assert.equal(term.curAttrData.getFgColorMode(), 0); // DEFAULT
      assert.equal(term.curAttrData.getBgColorMode(), 0); // DEFAULT
      // lower 8 colors
      for (let i = 0; i < 8; ++i) {
        term.writeSync(`\x1b[${i + 30};${i + 40}m`);
        assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P16);
        assert.equal(term.curAttrData.getFgColor(), i);
        assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P16);
        assert.equal(term.curAttrData.getBgColor(), i);
      }
      // reset to DEFAULT
      term.writeSync(`\x1b[39;49m`);
      assert.equal(term.curAttrData.getFgColorMode(), 0);
      assert.equal(term.curAttrData.getBgColorMode(), 0);
    });
    it('colormode palette 256', () => {
      assert.equal(term.curAttrData.getFgColorMode(), 0); // DEFAULT
      assert.equal(term.curAttrData.getBgColorMode(), 0); // DEFAULT
      // lower 8 colors
      for (let i = 0; i < 256; ++i) {
        term.writeSync(`\x1b[38;5;${i};48;5;${i}m`);
        assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P256);
        assert.equal(term.curAttrData.getFgColor(), i);
        assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P256);
        assert.equal(term.curAttrData.getBgColor(), i);
      }
      // reset to DEFAULT
      term.writeSync(`\x1b[39;49m`);
      assert.equal(term.curAttrData.getFgColorMode(), 0);
      assert.equal(term.curAttrData.getFgColor(), -1);
      assert.equal(term.curAttrData.getBgColorMode(), 0);
      assert.equal(term.curAttrData.getBgColor(), -1);
    });
    it('colormode RGB', () => {
      assert.equal(term.curAttrData.getFgColorMode(), 0); // DEFAULT
      assert.equal(term.curAttrData.getBgColorMode(), 0); // DEFAULT
      term.writeSync(`\x1b[38;2;1;2;3;48;2;4;5;6m`);
      assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_RGB);
      assert.equal(term.curAttrData.getFgColor(), 1 << 16 | 2 << 8 | 3);
      assert.deepEqual(AttributeData.toColorRGB(term.curAttrData.getFgColor()), [1, 2, 3]);
      assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_RGB);
      assert.deepEqual(AttributeData.toColorRGB(term.curAttrData.getBgColor()), [4, 5, 6]);
      // reset to DEFAULT
      term.writeSync(`\x1b[39;49m`);
      assert.equal(term.curAttrData.getFgColorMode(), 0);
      assert.equal(term.curAttrData.getFgColor(), -1);
      assert.equal(term.curAttrData.getBgColorMode(), 0);
      assert.equal(term.curAttrData.getBgColor(), -1);
    });
    it('colormode transition RGB to 256', () => {
      // enter RGB for FG and BG
      term.writeSync(`\x1b[38;2;1;2;3;48;2;4;5;6m`);
      // enter 256 for FG and BG
      term.writeSync(`\x1b[38;5;255;48;5;255m`);
      assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P256);
      assert.equal(term.curAttrData.getFgColor(), 255);
      assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P256);
      assert.equal(term.curAttrData.getBgColor(), 255);
    });
    it('colormode transition RGB to 16', () => {
      // enter RGB for FG and BG
      term.writeSync(`\x1b[38;2;1;2;3;48;2;4;5;6m`);
      // enter 16 for FG and BG
      term.writeSync(`\x1b[37;47m`);
      assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P16);
      assert.equal(term.curAttrData.getFgColor(), 7);
      assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P16);
      assert.equal(term.curAttrData.getBgColor(), 7);
    });
    it('colormode transition 16 to 256', () => {
      // enter 16 for FG and BG
      term.writeSync(`\x1b[37;47m`);
      // enter 256 for FG and BG
      term.writeSync(`\x1b[38;5;255;48;5;255m`);
      assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P256);
      assert.equal(term.curAttrData.getFgColor(), 255);
      assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P256);
      assert.equal(term.curAttrData.getBgColor(), 255);
    });
    it('colormode transition 256 to 16', () => {
      // enter 256 for FG and BG
      term.writeSync(`\x1b[38;5;255;48;5;255m`);
      // enter 16 for FG and BG
      term.writeSync(`\x1b[37;47m`);
      assert.equal(term.curAttrData.getFgColorMode(), Attributes.CM_P16);
      assert.equal(term.curAttrData.getFgColor(), 7);
      assert.equal(term.curAttrData.getBgColorMode(), Attributes.CM_P16);
      assert.equal(term.curAttrData.getBgColor(), 7);
    });
    it('should zero missing RGB values', () => {
      term.writeSync(`\x1b[38;2;1;2;3m`);
      term.writeSync(`\x1b[38;2;5m`);
      assert.deepEqual(AttributeData.toColorRGB(term.curAttrData.getFgColor()), [5, 0, 0]);
    });
  });
  describe('colon notation', () => {
    let termColon: TestTerminal;
    let termSemicolon: TestTerminal;
    beforeEach(() => {
      termColon = new TestTerminal();
      termSemicolon = new TestTerminal();
    });
    describe('should equal to semicolon', () => {
      it('CSI 38:2::50:100:150 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;100;150m');
        termColon.writeSync('\x1b[38:2::50:100:150m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:2::50:100: m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;100;m');
        termColon.writeSync('\x1b[38:2::50:100:m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:2::50:: m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;;m');
        termColon.writeSync('\x1b[38:2::50::m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 0 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:2:::: m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;;;m');
        termColon.writeSync('\x1b[38:2::::m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 0 << 16 | 0 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38;2::50:100:150 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;100;150m');
        termColon.writeSync('\x1b[38;2::50:100:150m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38;2;50:100:150 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;100;150m');
        termColon.writeSync('\x1b[38;2;50:100:150m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38;2;50;100:150 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2;50;100;150m');
        termColon.writeSync('\x1b[38;2;50;100:150m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:5:50 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;5;50m');
        termColon.writeSync('\x1b[38:5:50m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFF, 50);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:5: m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;5;m');
        termColon.writeSync('\x1b[38:5:m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFF, 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38;5:50 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;5;50m');
        termColon.writeSync('\x1b[38;5:50m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFF, 50);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
    });
    describe('should fill early sequence end with default of 0', () => {
      it('CSI 38:2 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;2m');
        termColon.writeSync('\x1b[38:2m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 0 << 16 | 0 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 38:5 m', () => {
        termColon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.curAttrData.fg = 0xFFFFFFFF;
        termSemicolon.writeSync('\x1b[38;5m');
        termColon.writeSync('\x1b[38:5m');
        assert.equal(termSemicolon.curAttrData.fg & 0xFF, 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
    });
    describe('should not interfere with leading/following SGR attrs', () => {
      it('CSI 1 ; 38:2::50:100:150 ; 4 m', () => {
        termSemicolon.writeSync('\x1b[1;38;2;50;100;150;4m');
        termColon.writeSync('\x1b[1;38:2::50:100:150;4m');
        assert.equal(!!termSemicolon.curAttrData.isBold(), true);
        assert.equal(!!termSemicolon.curAttrData.isUnderline(), true);
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 150);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 1 ; 38:2::50:100: ; 4 m', () => {
        termSemicolon.writeSync('\x1b[1;38;2;50;100;;4m');
        termColon.writeSync('\x1b[1;38:2::50:100:;4m');
        assert.equal(!!termSemicolon.curAttrData.isBold(), true);
        assert.equal(!!termSemicolon.curAttrData.isUnderline(), true);
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 1 ; 38:2::50:100 ; 4 m', () => {
        termSemicolon.writeSync('\x1b[1;38;2;50;100;;4m');
        termColon.writeSync('\x1b[1;38:2::50:100;4m');
        assert.equal(!!termSemicolon.curAttrData.isBold(), true);
        assert.equal(!!termSemicolon.curAttrData.isUnderline(), true);
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 50 << 16 | 100 << 8 | 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 1 ; 38:2:: ; 4 m', () => {
        termSemicolon.writeSync('\x1b[1;38;2;;;;4m');
        termColon.writeSync('\x1b[1;38:2::;4m');
        assert.equal(!!termSemicolon.curAttrData.isBold(), true);
        assert.equal(!!termSemicolon.curAttrData.isUnderline(), true);
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
      it('CSI 1 ; 38;2:: ; 4 m', () => {
        termSemicolon.writeSync('\x1b[1;38;2;;;;4m');
        termColon.writeSync('\x1b[1;38;2::;4m');
        assert.equal(!!termSemicolon.curAttrData.isBold(), true);
        assert.equal(!!termSemicolon.curAttrData.isUnderline(), true);
        assert.equal(termSemicolon.curAttrData.fg & 0xFFFFFF, 0);
        assert.equal(termColon.curAttrData.fg, termSemicolon.curAttrData.fg);
      });
    });
  });
  describe('cursor positioning', () => {
    let term: TestTerminal;
    beforeEach(() => {
      term = new TestTerminal({cols: 10, rows: 10});
    });
    it('cursor forward (CUF)', () => {
      term.writeSync('\x1b[C');
      assert.deepEqual(getCursor(term), [1, 0]);
      term.writeSync('\x1b[1C');
      assert.deepEqual(getCursor(term), [2, 0]);
      term.writeSync('\x1b[4C');
      assert.deepEqual(getCursor(term), [6, 0]);
      term.writeSync('\x1b[100C');
      assert.deepEqual(getCursor(term), [9, 0]);
      // should not change y
      term.buffer.x = 8;
      term.buffer.y = 4;
      term.writeSync('\x1b[C');
      assert.deepEqual(getCursor(term), [9, 4]);
    });
    it('cursor backward (CUB)', () => {
      term.writeSync('\x1b[D');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.writeSync('\x1b[1D');
      assert.deepEqual(getCursor(term), [0, 0]);
      // place cursor at end of first line
      term.writeSync('\x1b[100C');
      term.writeSync('\x1b[D');
      assert.deepEqual(getCursor(term), [8, 0]);
      term.writeSync('\x1b[1D');
      assert.deepEqual(getCursor(term), [7, 0]);
      term.writeSync('\x1b[4D');
      assert.deepEqual(getCursor(term), [3, 0]);
      term.writeSync('\x1b[100D');
      assert.deepEqual(getCursor(term), [0, 0]);
      // should not change y
      term.buffer.x = 4;
      term.buffer.y = 4;
      term.writeSync('\x1b[D');
      assert.deepEqual(getCursor(term), [3, 4]);
    });
    it('cursor down (CUD)', () => {
      term.writeSync('\x1b[B');
      assert.deepEqual(getCursor(term), [0, 1]);
      term.writeSync('\x1b[1B');
      assert.deepEqual(getCursor(term), [0, 2]);
      term.writeSync('\x1b[4B');
      assert.deepEqual(getCursor(term), [0, 6]);
      term.writeSync('\x1b[100B');
      assert.deepEqual(getCursor(term), [0, 9]);
      // should not change x
      term.buffer.x = 8;
      term.buffer.y = 0;
      term.writeSync('\x1b[B');
      assert.deepEqual(getCursor(term), [8, 1]);
    });
    it('cursor up (CUU)', () => {
      term.writeSync('\x1b[A');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.writeSync('\x1b[1A');
      assert.deepEqual(getCursor(term), [0, 0]);
      // place cursor at beginning of last row
      term.writeSync('\x1b[100B');
      term.writeSync('\x1b[A');
      assert.deepEqual(getCursor(term), [0, 8]);
      term.writeSync('\x1b[1A');
      assert.deepEqual(getCursor(term), [0, 7]);
      term.writeSync('\x1b[4A');
      assert.deepEqual(getCursor(term), [0, 3]);
      term.writeSync('\x1b[100A');
      assert.deepEqual(getCursor(term), [0, 0]);
      // should not change x
      term.buffer.x = 8;
      term.buffer.y = 9;
      term.writeSync('\x1b[A');
      assert.deepEqual(getCursor(term), [8, 8]);
    });
    it('cursor next line (CNL)', () => {
      term.writeSync('\x1b[E');
      assert.deepEqual(getCursor(term), [0, 1]);
      term.writeSync('\x1b[1E');
      assert.deepEqual(getCursor(term), [0, 2]);
      term.writeSync('\x1b[4E');
      assert.deepEqual(getCursor(term), [0, 6]);
      term.writeSync('\x1b[100E');
      assert.deepEqual(getCursor(term), [0, 9]);
      // should reset x to zero
      term.buffer.x = 8;
      term.buffer.y = 0;
      term.writeSync('\x1b[E');
      assert.deepEqual(getCursor(term), [0, 1]);
    });
    it('cursor previous line (CPL)', () => {
      term.writeSync('\x1b[F');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.writeSync('\x1b[1F');
      assert.deepEqual(getCursor(term), [0, 0]);
      // place cursor at beginning of last row
      term.writeSync('\x1b[100E');
      term.writeSync('\x1b[F');
      assert.deepEqual(getCursor(term), [0, 8]);
      term.writeSync('\x1b[1F');
      assert.deepEqual(getCursor(term), [0, 7]);
      term.writeSync('\x1b[4F');
      assert.deepEqual(getCursor(term), [0, 3]);
      term.writeSync('\x1b[100F');
      assert.deepEqual(getCursor(term), [0, 0]);
      // should reset x to zero
      term.buffer.x = 8;
      term.buffer.y = 9;
      term.writeSync('\x1b[F');
      assert.deepEqual(getCursor(term), [0, 8]);
    });
    it('cursor character absolute (CHA)', () => {
      term.writeSync('\x1b[G');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.writeSync('\x1b[1G');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.writeSync('\x1b[2G');
      assert.deepEqual(getCursor(term), [1, 0]);
      term.writeSync('\x1b[5G');
      assert.deepEqual(getCursor(term), [4, 0]);
      term.writeSync('\x1b[100G');
      assert.deepEqual(getCursor(term), [9, 0]);
    });
    it('cursor position (CUP)', () => {
      term.buffer.x = 5;
      term.buffer.y = 5;
      term.writeSync('\x1b[H');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.buffer.x = 5;
      term.buffer.y = 5;
      term.writeSync('\x1b[1H');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.buffer.x = 5;
      term.buffer.y = 5;
      term.writeSync('\x1b[1;1H');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.buffer.x = 5;
      term.buffer.y = 5;
      term.writeSync('\x1b[8H');
      assert.deepEqual(getCursor(term), [0, 7]);
      term.buffer.x = 5;
      term.buffer.y = 5;
      term.writeSync('\x1b[;8H');
      assert.deepEqual(getCursor(term), [7, 0]);
      term.buffer.x = 5;
      term.buffer.y = 5;
      term.writeSync('\x1b[100;100H');
      assert.deepEqual(getCursor(term), [9, 9]);
    });
    it('horizontal position absolute (HPA)', () => {
      term.writeSync('\x1b[`');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.writeSync('\x1b[1`');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.writeSync('\x1b[2`');
      assert.deepEqual(getCursor(term), [1, 0]);
      term.writeSync('\x1b[5`');
      assert.deepEqual(getCursor(term), [4, 0]);
      term.writeSync('\x1b[100`');
      assert.deepEqual(getCursor(term), [9, 0]);
    });
    it('horizontal position relative (HPR)', () => {
      term.writeSync('\x1b[a');
      assert.deepEqual(getCursor(term), [1, 0]);
      term.writeSync('\x1b[1a');
      assert.deepEqual(getCursor(term), [2, 0]);
      term.writeSync('\x1b[4a');
      assert.deepEqual(getCursor(term), [6, 0]);
      term.writeSync('\x1b[100a');
      assert.deepEqual(getCursor(term), [9, 0]);
      // should not change y
      term.buffer.x = 8;
      term.buffer.y = 4;
      term.writeSync('\x1b[a');
      assert.deepEqual(getCursor(term), [9, 4]);
    });
    it('vertical position absolute (VPA)', () => {
      term.writeSync('\x1b[d');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.writeSync('\x1b[1d');
      assert.deepEqual(getCursor(term), [0, 0]);
      term.writeSync('\x1b[2d');
      assert.deepEqual(getCursor(term), [0, 1]);
      term.writeSync('\x1b[5d');
      assert.deepEqual(getCursor(term), [0, 4]);
      term.writeSync('\x1b[100d');
      assert.deepEqual(getCursor(term), [0, 9]);
      // should not change x
      term.buffer.x = 8;
      term.buffer.y = 4;
      term.writeSync('\x1b[d');
      assert.deepEqual(getCursor(term), [8, 0]);
    });
    it('vertical position relative (VPR)', () => {
      term.writeSync('\x1b[e');
      assert.deepEqual(getCursor(term), [0, 1]);
      term.writeSync('\x1b[1e');
      assert.deepEqual(getCursor(term), [0, 2]);
      term.writeSync('\x1b[4e');
      assert.deepEqual(getCursor(term), [0, 6]);
      term.writeSync('\x1b[100e');
      assert.deepEqual(getCursor(term), [0, 9]);
      // should not change x
      term.buffer.x = 8;
      term.buffer.y = 4;
      term.writeSync('\x1b[e');
      assert.deepEqual(getCursor(term), [8, 5]);
    });
    describe('should clamp cursor into addressible range', () => {
      it('CUF', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[C');
        assert.deepEqual(getCursor(term), [9, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[C');
        assert.deepEqual(getCursor(term), [1, 0]);
      });
      it('CUB', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[D');
        assert.deepEqual(getCursor(term), [8, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[D');
        assert.deepEqual(getCursor(term), [0, 0]);
      });
      it('CUD', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[B');
        assert.deepEqual(getCursor(term), [9, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[B');
        assert.deepEqual(getCursor(term), [0, 1]);
      });
      it('CUU', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[A');
        assert.deepEqual(getCursor(term), [9, 8]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[A');
        assert.deepEqual(getCursor(term), [0, 0]);
      });
      it('CNL', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[E');
        assert.deepEqual(getCursor(term), [0, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[E');
        assert.deepEqual(getCursor(term), [0, 1]);
      });
      it('CPL', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[F');
        assert.deepEqual(getCursor(term), [0, 8]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[F');
        assert.deepEqual(getCursor(term), [0, 0]);
      });
      it('CHA', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[5G');
        assert.deepEqual(getCursor(term), [4, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[5G');
        assert.deepEqual(getCursor(term), [4, 0]);
      });
      it('CUP', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[5;5H');
        assert.deepEqual(getCursor(term), [4, 4]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[5;5H');
        assert.deepEqual(getCursor(term), [4, 4]);
      });
      it('HPA', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[5`');
        assert.deepEqual(getCursor(term), [4, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[5`');
        assert.deepEqual(getCursor(term), [4, 0]);
      });
      it('HPR', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[a');
        assert.deepEqual(getCursor(term), [9, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[a');
        assert.deepEqual(getCursor(term), [1, 0]);
      });
      it('VPA', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[5d');
        assert.deepEqual(getCursor(term), [9, 4]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[5d');
        assert.deepEqual(getCursor(term), [0, 4]);
      });
      it('VPR', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[e');
        assert.deepEqual(getCursor(term), [9, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[e');
        assert.deepEqual(getCursor(term), [0, 1]);
      });
      it('DCH', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[P');
        assert.deepEqual(getCursor(term), [9, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[P');
        assert.deepEqual(getCursor(term), [0, 0]);
      });
      it('DCH - should delete last cell', () => {
        term.writeSync('0123456789\x1b[P');
        assert.equal(term.buffer.lines.get(0).translateToString(false), '012345678 ');
      });
      it('ECH', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[X');
        assert.deepEqual(getCursor(term), [9, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[X');
        assert.deepEqual(getCursor(term), [0, 0]);
      });
      it('ECH - should delete last cell', () => {
        term.writeSync('0123456789\x1b[X');
        assert.equal(term.buffer.lines.get(0).translateToString(false), '012345678 ');
      });
      it('ICH', () => {
        term.buffer.x = 10000;
        term.buffer.y = 10000;
        term.writeSync('\x1b[@');
        assert.deepEqual(getCursor(term), [9, 9]);
        term.buffer.x = -10000;
        term.buffer.y = -10000;
        term.writeSync('\x1b[@');
        assert.deepEqual(getCursor(term), [0, 0]);
      });
      it('ICH - should delete last cell', () => {
        term.writeSync('0123456789\x1b[@');
        assert.equal(term.buffer.lines.get(0).translateToString(false), '012345678 ');
      });
    });
  });
  describe('DECSTBM - scroll margins', () => {
    let term: TestTerminal;
    beforeEach(() => {
      term = new TestTerminal({cols: 10, rows: 10});
    });
    it('should default to whole viewport', () => {
      term.writeSync('\x1b[r');
      assert.equal(term.buffer.scrollTop, 0);
      assert.equal(term.buffer.scrollBottom, 9);
      term.writeSync('\x1b[3;7r');
      assert.equal(term.buffer.scrollTop, 2);
      assert.equal(term.buffer.scrollBottom, 6);
      term.writeSync('\x1b[0;0r');
      assert.equal(term.buffer.scrollTop, 0);
      assert.equal(term.buffer.scrollBottom, 9);
    });
    it('should clamp bottom', () => {
      term.writeSync('\x1b[3;1000r');
      assert.equal(term.buffer.scrollTop, 2);
      assert.equal(term.buffer.scrollBottom, 9);
    });
    it('should only apply for top < bottom', () => {
      term.writeSync('\x1b[7;2r');
      assert.equal(term.buffer.scrollTop, 0);
      assert.equal(term.buffer.scrollBottom, 9);
    });
    it('should home cursor', () => {
      term.buffer.x = 10000;
      term.buffer.y = 10000;
      term.writeSync('\x1b[2;7r');
      assert.deepEqual(getCursor(term), [0, 0]);
    });
  });
  describe('scroll margins', () => {
    let term: TestTerminal;
    beforeEach(() => {
      term = new TestTerminal({cols: 10, rows: 10});
    });
    it('scrollUp', () => {
      term.writeSync('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[2;4r\x1b[2Sm');
      assert.deepEqual(getLines(term), ['m', '3', '', '', '4', '5', '6', '7', '8', '9']);
    });
    it('scrollDown', () => {
      term.writeSync('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[2;4r\x1b[2Tm');
      assert.deepEqual(getLines(term), ['m', '', '', '1', '4', '5', '6', '7', '8', '9']);
    });
    it('insertLines - out of margins', () => {
      term.writeSync('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[3;6r');
      assert.equal(term.buffer.scrollTop, 2);
      assert.equal(term.buffer.scrollBottom, 5);
      term.writeSync('\x1b[2Lm');
      assert.deepEqual(getLines(term), ['m', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
      term.writeSync('\x1b[2H\x1b[2Ln');
      assert.deepEqual(getLines(term), ['m', 'n', '2', '3', '4', '5', '6', '7', '8', '9']);
      // skip below scrollbottom
      term.writeSync('\x1b[7H\x1b[2Lo');
      assert.deepEqual(getLines(term), ['m', 'n', '2', '3', '4', '5', 'o', '7', '8', '9']);
      term.writeSync('\x1b[8H\x1b[2Lp');
      assert.deepEqual(getLines(term), ['m', 'n', '2', '3', '4', '5', 'o', 'p', '8', '9']);
      term.writeSync('\x1b[100H\x1b[2Lq');
      assert.deepEqual(getLines(term), ['m', 'n', '2', '3', '4', '5', 'o', 'p', '8', 'q']);
    });
    it('insertLines - within margins', () => {
      term.writeSync('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[3;6r');
      assert.equal(term.buffer.scrollTop, 2);
      assert.equal(term.buffer.scrollBottom, 5);
      term.writeSync('\x1b[3H\x1b[2Lm');
      assert.deepEqual(getLines(term), ['0', '1', 'm', '', '2', '3', '6', '7', '8', '9']);
      term.writeSync('\x1b[6H\x1b[2Ln');
      assert.deepEqual(getLines(term), ['0', '1', 'm', '', '2', 'n', '6', '7', '8', '9']);
    });
    it('deleteLines - out of margins', () => {
      term.writeSync('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[3;6r');
      assert.equal(term.buffer.scrollTop, 2);
      assert.equal(term.buffer.scrollBottom, 5);
      term.writeSync('\x1b[2Mm');
      assert.deepEqual(getLines(term), ['m', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
      term.writeSync('\x1b[2H\x1b[2Mn');
      assert.deepEqual(getLines(term), ['m', 'n', '2', '3', '4', '5', '6', '7', '8', '9']);
      // skip below scrollbottom
      term.writeSync('\x1b[7H\x1b[2Mo');
      assert.deepEqual(getLines(term), ['m', 'n', '2', '3', '4', '5', 'o', '7', '8', '9']);
      term.writeSync('\x1b[8H\x1b[2Mp');
      assert.deepEqual(getLines(term), ['m', 'n', '2', '3', '4', '5', 'o', 'p', '8', '9']);
      term.writeSync('\x1b[100H\x1b[2Mq');
      assert.deepEqual(getLines(term), ['m', 'n', '2', '3', '4', '5', 'o', 'p', '8', 'q']);
    });
    it('deleteLines - within margins', () => {
      term.writeSync('0\r\n1\r\n2\r\n3\r\n4\r\n5\r\n6\r\n7\r\n8\r\n9\x1b[3;6r');
      assert.equal(term.buffer.scrollTop, 2);
      assert.equal(term.buffer.scrollBottom, 5);
      term.writeSync('\x1b[6H\x1b[2Mm');
      assert.deepEqual(getLines(term), ['0', '1', '2', '3', '4', 'm', '6', '7', '8', '9']);
      term.writeSync('\x1b[3H\x1b[2Mn');
      assert.deepEqual(getLines(term), ['0', '1', 'n', 'm',  '',  '', '6', '7', '8', '9']);
    });
  });
  describe('SL/SR/DECIC/DECDC', () => {
    let term: TestTerminal;
    beforeEach(() => {
      term = new TestTerminal({cols: 5, rows: 5, scrollback: 1});
    });
    it('SL (scrollLeft)', () => {
      term.writeSync('12345'.repeat(6));
      term.writeSync('\x1b[ @');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '2345', '2345', '2345', '2345', '2345']);
      term.writeSync('\x1b[0 @');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '345', '345', '345', '345', '345']);
      term.writeSync('\x1b[2 @');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '5', '5', '5', '5', '5']);
    });
    it('SR (scrollRight)', () => {
      term.writeSync('12345'.repeat(6));
      term.writeSync('\x1b[ A');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', ' 1234', ' 1234', ' 1234', ' 1234', ' 1234']);
      term.writeSync('\x1b[0 A');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '  123', '  123', '  123', '  123', '  123']);
      term.writeSync('\x1b[2 A');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '    1', '    1', '    1', '    1', '    1']);
    });
    it('insertColumns (DECIC)', () => {
      term.writeSync('12345'.repeat(6));
      term.writeSync('\x1b[3;3H');
      term.writeSync('\x1b[\'}');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '12 34', '12 34', '12 34', '12 34', '12 34']);
      term.reset();
      term.writeSync('12345'.repeat(6));
      term.writeSync('\x1b[3;3H');
      term.writeSync('\x1b[1\'}');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '12 34', '12 34', '12 34', '12 34', '12 34']);
      term.reset();
      term.writeSync('12345'.repeat(6));
      term.writeSync('\x1b[3;3H');
      term.writeSync('\x1b[2\'}');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '12  3', '12  3', '12  3', '12  3', '12  3']);
    });
    it('deleteColumns (DECDC)', () => {
      term.writeSync('12345'.repeat(6));
      term.writeSync('\x1b[3;3H');
      term.writeSync('\x1b[\'~');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '1245', '1245', '1245', '1245', '1245']);
      term.reset();
      term.writeSync('12345'.repeat(6));
      term.writeSync('\x1b[3;3H');
      term.writeSync('\x1b[1\'~');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '1245', '1245', '1245', '1245', '1245']);
      term.reset();
      term.writeSync('12345'.repeat(6));
      term.writeSync('\x1b[3;3H');
      term.writeSync('\x1b[2\'~');
      assert.deepEqual(getLines(term, term.rows + 1), ['12345', '125', '125', '125', '125', '125']);
    });
  });
  it('should parse big chunks in smaller subchunks', () => {
    // max single chunk size is hardcoded as 131072
    const calls: any[] = [];
    const term = new TestTerminal({cols: 10, rows: 10});
    (term as any)._inputHandler._parser.parse = (data: Uint32Array, length: number) => {
      calls.push([data.length, length]);
    };
    term.writeSync('12345');
    term.writeSync('a'.repeat(10000));
    term.writeSync('a'.repeat(200000));
    term.writeSync('a'.repeat(300000));
    assert.deepEqual(calls, [
      [4096, 5],
      [10000, 10000],
      [131072, 131072], [131072, 200000 - 131072],
      [131072, 131072], [131072, 131072], [131072, 300000 - 131072 - 131072]
    ]);
  });
  describe('windowOptions', () => {
    it('all should be disabled by default and not report', () => {
      const term = new TestTerminal({cols: 10, rows: 10});
      const stack: string[] = [];
      term.onData(data => stack.push(data));
      term.writeSync('\x1b[14t');
      term.writeSync('\x1b[16t');
      term.writeSync('\x1b[18t');
      term.writeSync('\x1b[20t');
      term.writeSync('\x1b[21t');
      assert.deepEqual(stack, []);
    });
    it('14 - GetWinSizePixels', () => {
      const term = new TestTerminal({cols: 10, rows: 10, windowOptions: {getWinSizePixels: true}});
      const stack: string[] = [];
      term.onData(data => stack.push(data));
      term.writeSync('\x1b[14t');
      // does not report in test terminal due to missing renderer
      assert.deepEqual(stack, []);
    });
    it('16 - GetCellSizePixels', () => {
      const term = new TestTerminal({cols: 10, rows: 10, windowOptions: {getCellSizePixels: true}});
      const stack: string[] = [];
      term.onData(data => stack.push(data));
      term.writeSync('\x1b[16t');
      // does not report in test terminal due to missing renderer
      assert.deepEqual(stack, []);
    });
    it('18 - GetWinSizeChars', () => {
      const term = new TestTerminal({cols: 10, rows: 10, windowOptions: {getWinSizeChars: true}});
      const stack: string[] = [];
      term.onData(data => stack.push(data));
      term.writeSync('\x1b[18t');
      assert.deepEqual(stack, ['\x1b[8;10;10t']);
      term.resize(50, 20);
      term.writeSync('\x1b[18t');
      assert.deepEqual(stack, ['\x1b[8;10;10t', '\x1b[8;20;50t']);
    });
    it('22/23 - PushTitle/PopTitle', () => {
      const term = new TestTerminal({cols: 10, rows: 10, windowOptions: {pushTitle: true, popTitle: true}});
      const stack: string[] = [];
      term.onTitleChange(data => stack.push(data));
      term.writeSync('\x1b]0;1\x07');
      term.writeSync('\x1b[22t');
      term.writeSync('\x1b]0;2\x07');
      term.writeSync('\x1b[22t');
      term.writeSync('\x1b]0;3\x07');
      term.writeSync('\x1b[22t');
      assert.deepEqual((term as any)._inputHandler._windowTitleStack, ['1', '2', '3']);
      assert.deepEqual((term as any)._inputHandler._iconNameStack, ['1', '2', '3']);
      assert.deepEqual(stack, ['1', '2', '3']);
      term.writeSync('\x1b[23t');
      term.writeSync('\x1b[23t');
      term.writeSync('\x1b[23t');
      term.writeSync('\x1b[23t'); // one more to test "overflow"
      assert.deepEqual((term as any)._inputHandler._windowTitleStack, []);
      assert.deepEqual((term as any)._inputHandler._iconNameStack, []);
      assert.deepEqual(stack, ['1', '2', '3', '3', '2', '1']);
    });
    it('22/23 - PushTitle/PopTitle with ;1', () => {
      const term = new TestTerminal({cols: 10, rows: 10, windowOptions: {pushTitle: true, popTitle: true}});
      const stack: string[] = [];
      term.onTitleChange(data => stack.push(data));
      term.writeSync('\x1b]0;1\x07');
      term.writeSync('\x1b[22;1t');
      term.writeSync('\x1b]0;2\x07');
      term.writeSync('\x1b[22;1t');
      term.writeSync('\x1b]0;3\x07');
      term.writeSync('\x1b[22;1t');
      assert.deepEqual((term as any)._inputHandler._windowTitleStack, []);
      assert.deepEqual((term as any)._inputHandler._iconNameStack, ['1', '2', '3']);
      assert.deepEqual(stack, ['1', '2', '3']);
      term.writeSync('\x1b[23;1t');
      term.writeSync('\x1b[23;1t');
      term.writeSync('\x1b[23;1t');
      term.writeSync('\x1b[23;1t'); // one more to test "overflow"
      assert.deepEqual((term as any)._inputHandler._windowTitleStack, []);
      assert.deepEqual((term as any)._inputHandler._iconNameStack, []);
      assert.deepEqual(stack, ['1', '2', '3']);
    });
    it('22/23 - PushTitle/PopTitle with ;2', () => {
      const term = new TestTerminal({cols: 10, rows: 10, windowOptions: {pushTitle: true, popTitle: true}});
      const stack: string[] = [];
      term.onTitleChange(data => stack.push(data));
      term.writeSync('\x1b]0;1\x07');
      term.writeSync('\x1b[22;2t');
      term.writeSync('\x1b]0;2\x07');
      term.writeSync('\x1b[22;2t');
      term.writeSync('\x1b]0;3\x07');
      term.writeSync('\x1b[22;2t');
      assert.deepEqual((term as any)._inputHandler._windowTitleStack, ['1', '2', '3']);
      assert.deepEqual((term as any)._inputHandler._iconNameStack, []);
      assert.deepEqual(stack, ['1', '2', '3']);
      term.writeSync('\x1b[23;2t');
      term.writeSync('\x1b[23;2t');
      term.writeSync('\x1b[23;2t');
      term.writeSync('\x1b[23;2t'); // one more to test "overflow"
      assert.deepEqual((term as any)._inputHandler._windowTitleStack, []);
      assert.deepEqual((term as any)._inputHandler._iconNameStack, []);
      assert.deepEqual(stack, ['1', '2', '3', '3', '2', '1']);
    });
    it('DECCOLM - should only work with "SetWinLines" (24) enabled', () => {
      // disabled
      const term = new TestTerminal({cols: 10, rows: 10});
      term.writeSync('\x1b[?3l');
      assert.equal((term as any)._bufferService.cols, 10);
      term.writeSync('\x1b[?3h');
      assert.equal((term as any)._bufferService.cols, 10);
      // enabled
      const term2 = new TestTerminal({cols: 10, rows: 10, windowOptions: {setWinLines: true}});
      term2.writeSync('\x1b[?3l');
      assert.equal((term2 as any)._bufferService.cols, 80);
      term2.writeSync('\x1b[?3h');
      assert.equal((term2 as any)._bufferService.cols, 132);
    });
  });
  describe('should correctly reset cells taken by wide chars', () => {
    let term: TestTerminal;
    beforeEach(() => {
      term = new TestTerminal({cols: 10, rows: 5, scrollback: 1});
      term.writeSync('￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥￥');
    });
    it('print', () => {
      term.writeSync('\x1b[H#');
      assert.deepEqual(getLines(term), ['# ￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[1;6H######');
      assert.deepEqual(getLines(term), ['# ￥ #####', '# ￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('#');
      assert.deepEqual(getLines(term), ['# ￥ #####', '##￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('#');
      assert.deepEqual(getLines(term), ['# ￥ #####', '### ￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[3;9H#');
      assert.deepEqual(getLines(term), ['# ￥ #####', '### ￥￥￥', '￥￥￥￥#', '￥￥￥￥￥', '']);
      term.writeSync('#');
      assert.deepEqual(getLines(term), ['# ￥ #####', '### ￥￥￥', '￥￥￥￥##', '￥￥￥￥￥', '']);
      term.writeSync('#');
      assert.deepEqual(getLines(term), ['# ￥ #####', '### ￥￥￥', '￥￥￥￥##', '# ￥￥￥￥', '']);
      term.writeSync('\x1b[4;10H#');
      assert.deepEqual(getLines(term), ['# ￥ #####', '### ￥￥￥', '￥￥￥￥##', '# ￥￥￥ #', '']);
    });
    it('EL', () => {
      term.writeSync('\x1b[1;6H\x1b[K#');
      assert.deepEqual(getLines(term), ['￥￥ #', '￥￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[2;5H\x1b[1K');
      assert.deepEqual(getLines(term), ['￥￥ #', '      ￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[3;6H\x1b[1K');
      assert.deepEqual(getLines(term), ['￥￥ #', '      ￥￥', '      ￥￥', '￥￥￥￥￥', '']);
    });
    it('ICH', () => {
      term.writeSync('\x1b[1;6H\x1b[@');
      assert.deepEqual(getLines(term), ['￥￥   ￥', '￥￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[2;4H\x1b[2@');
      assert.deepEqual(getLines(term), ['￥￥   ￥', '￥    ￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[3;4H\x1b[3@');
      assert.deepEqual(getLines(term), ['￥￥   ￥', '￥    ￥￥', '￥     ￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[4;4H\x1b[4@');
      assert.deepEqual(getLines(term), ['￥￥   ￥', '￥    ￥￥', '￥     ￥', '￥      ￥', '']);
    });
    it('DCH', () => {
      term.writeSync('\x1b[1;6H\x1b[P');
      assert.deepEqual(getLines(term), ['￥￥ ￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[2;6H\x1b[2P');
      assert.deepEqual(getLines(term), ['￥￥ ￥￥', '￥￥  ￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[3;6H\x1b[3P');
      assert.deepEqual(getLines(term), ['￥￥ ￥￥', '￥￥  ￥', '￥￥ ￥', '￥￥￥￥￥', '']);
    });
    it('ECH', () => {
      term.writeSync('\x1b[1;6H\x1b[X');
      assert.deepEqual(getLines(term), ['￥￥  ￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[2;6H\x1b[2X');
      assert.deepEqual(getLines(term), ['￥￥  ￥￥', '￥￥    ￥', '￥￥￥￥￥', '￥￥￥￥￥', '']);
      term.writeSync('\x1b[3;6H\x1b[3X');
      assert.deepEqual(getLines(term), ['￥￥  ￥￥', '￥￥    ￥', '￥￥    ￥', '￥￥￥￥￥', '']);
    });
  });
  describe('extended underline style support (SGR 4)', () => {
    let term: TestTerminal;
    beforeEach(() => {
      term = new TestTerminal({cols: 10, rows: 5});
    });
    it('4 | 24', () => {
      term.writeSync('\x1b[4m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.SINGLE);
      term.writeSync('\x1b[24m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('21 | 24', () => {
      term.writeSync('\x1b[21m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.DOUBLE);
      term.writeSync('\x1b[24m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:1 | 4:0', () => {
      term.writeSync('\x1b[4:1m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.SINGLE);
      term.writeSync('\x1b[4:0m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
      term.writeSync('\x1b[4:1m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.SINGLE);
      term.writeSync('\x1b[24m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:2 | 4:0', () => {
      term.writeSync('\x1b[4:2m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.DOUBLE);
      term.writeSync('\x1b[4:0m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
      term.writeSync('\x1b[4:2m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.DOUBLE);
      term.writeSync('\x1b[24m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:3 | 4:0', () => {
      term.writeSync('\x1b[4:3m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.CURLY);
      term.writeSync('\x1b[4:0m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
      term.writeSync('\x1b[4:3m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.CURLY);
      term.writeSync('\x1b[24m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:4 | 4:0', () => {
      term.writeSync('\x1b[4:4m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.DOTTED);
      term.writeSync('\x1b[4:0m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
      term.writeSync('\x1b[4:4m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.DOTTED);
      term.writeSync('\x1b[24m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:5 | 4:0', () => {
      term.writeSync('\x1b[4:5m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.DASHED);
      term.writeSync('\x1b[4:0m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
      term.writeSync('\x1b[4:5m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.DASHED);
      term.writeSync('\x1b[24m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.NONE);
    });
    it('4:x --> 4 should revert to single underline', () => {
      term.writeSync('\x1b[4:5m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.DASHED);
      term.writeSync('\x1b[4m');
      assert.equal(term.curAttrData.getUnderlineStyle(), UnderlineStyle.SINGLE);
    });
  });
  describe('underline colors (SGR 58 & SGR 59)', () => {
    let term: TestTerminal;
    beforeEach(() => {
      term = new TestTerminal({cols: 10, rows: 5});
    });
    it('defaults to FG color', () => {
      for (const s of ['', '\x1b[30m', '\x1b[38;510m', '\x1b[38;2;1;2;3m']) {
        term.writeSync(s);
        assert.equal(term.curAttrData.getUnderlineColor(), term.curAttrData.getFgColor());
        assert.equal(term.curAttrData.getUnderlineColorMode(), term.curAttrData.getFgColorMode());
        assert.equal(term.curAttrData.isUnderlineColorRGB(), term.curAttrData.isFgRGB());
        assert.equal(term.curAttrData.isUnderlineColorPalette(), term.curAttrData.isFgPalette());
        assert.equal(term.curAttrData.isUnderlineColorDefault(), term.curAttrData.isFgDefault());
      }
    });
    it('correctly sets P256/RGB colors', () => {
      term.writeSync('\x1b[4m');
      term.writeSync('\x1b[58;5;123m');
      assert.equal(term.curAttrData.getUnderlineColor(), 123);
      assert.equal(term.curAttrData.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(term.curAttrData.isUnderlineColorRGB(), false);
      assert.equal(term.curAttrData.isUnderlineColorPalette(), true);
      assert.equal(term.curAttrData.isUnderlineColorDefault(), false);
      term.writeSync('\x1b[58;2::1:2:3m');
      assert.equal(term.curAttrData.getUnderlineColor(), (1 << 16) | (2 << 8) | 3);
      assert.equal(term.curAttrData.getUnderlineColorMode(), Attributes.CM_RGB);
      assert.equal(term.curAttrData.isUnderlineColorRGB(), true);
      assert.equal(term.curAttrData.isUnderlineColorPalette(), false);
      assert.equal(term.curAttrData.isUnderlineColorDefault(), false);
    });
    it('P256/RGB persistence', () => {
      const cell = new CellData();
      term.writeSync('\x1b[4m');
      term.writeSync('\x1b[58;5;123m');
      assert.equal(term.curAttrData.getUnderlineColor(), 123);
      assert.equal(term.curAttrData.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(term.curAttrData.isUnderlineColorRGB(), false);
      assert.equal(term.curAttrData.isUnderlineColorPalette(), true);
      assert.equal(term.curAttrData.isUnderlineColorDefault(), false);
      term.writeSync('ab');
      (term as any)._bufferService.buffers.active.lines.get(0).loadCell(1, cell);
      assert.equal(cell.getUnderlineColor(), 123);
      assert.equal(cell.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(cell.isUnderlineColorRGB(), false);
      assert.equal(cell.isUnderlineColorPalette(), true);
      assert.equal(cell.isUnderlineColorDefault(), false);

      term.writeSync('\x1b[4:0m');
      assert.equal(term.curAttrData.getUnderlineColor(), term.curAttrData.getFgColor());
      assert.equal(term.curAttrData.getUnderlineColorMode(), term.curAttrData.getFgColorMode());
      assert.equal(term.curAttrData.isUnderlineColorRGB(), term.curAttrData.isFgRGB());
      assert.equal(term.curAttrData.isUnderlineColorPalette(), term.curAttrData.isFgPalette());
      assert.equal(term.curAttrData.isUnderlineColorDefault(), term.curAttrData.isFgDefault());
      term.writeSync('a');
      (term as any)._bufferService.buffers.active.lines.get(0).loadCell(1, cell);
      assert.equal(cell.getUnderlineColor(), 123);
      assert.equal(cell.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(cell.isUnderlineColorRGB(), false);
      assert.equal(cell.isUnderlineColorPalette(), true);
      assert.equal(cell.isUnderlineColorDefault(), false);
      (term as any)._bufferService.buffers.active.lines.get(0).loadCell(2, cell);
      assert.equal(cell.getUnderlineColor(), term.curAttrData.getFgColor());
      assert.equal(cell.getUnderlineColorMode(), term.curAttrData.getFgColorMode());
      assert.equal(cell.isUnderlineColorRGB(), term.curAttrData.isFgRGB());
      assert.equal(cell.isUnderlineColorPalette(), term.curAttrData.isFgPalette());
      assert.equal(cell.isUnderlineColorDefault(), term.curAttrData.isFgDefault());

      term.writeSync('\x1b[4m');
      term.writeSync('\x1b[58;2::1:2:3m');
      assert.equal(term.curAttrData.getUnderlineColor(), (1 << 16) | (2 << 8) | 3);
      assert.equal(term.curAttrData.getUnderlineColorMode(), Attributes.CM_RGB);
      assert.equal(term.curAttrData.isUnderlineColorRGB(), true);
      assert.equal(term.curAttrData.isUnderlineColorPalette(), false);
      assert.equal(term.curAttrData.isUnderlineColorDefault(), false);
      term.writeSync('a');
      term.writeSync('\x1b[24m');
      (term as any)._bufferService.buffers.active.lines.get(0).loadCell(1, cell);
      assert.equal(cell.getUnderlineColor(), 123);
      assert.equal(cell.getUnderlineColorMode(), Attributes.CM_P256);
      assert.equal(cell.isUnderlineColorRGB(), false);
      assert.equal(cell.isUnderlineColorPalette(), true);
      assert.equal(cell.isUnderlineColorDefault(), false);
      (term as any)._bufferService.buffers.active.lines.get(0).loadCell(3, cell);
      assert.equal(cell.getUnderlineColor(), (1 << 16) | (2 << 8) | 3);
      assert.equal(cell.getUnderlineColorMode(), Attributes.CM_RGB);
      assert.equal(cell.isUnderlineColorRGB(), true);
      assert.equal(cell.isUnderlineColorPalette(), false);
      assert.equal(cell.isUnderlineColorDefault(), false);

      // eAttrs in buffer pos 0 and 1 should be the same object
      assert.equal(
        (term as any)._bufferService.buffers.active.lines.get(0)._extendedAttrs[0],
        (term as any)._bufferService.buffers.active.lines.get(0)._extendedAttrs[1]
      );
      // should not have written eAttr for pos 2 in the buffer
      assert.equal((term as any)._bufferService.buffers.active.lines.get(0)._extendedAttrs[2], undefined);
      // eAttrs in buffer pos 1 and pos 3 must be different objs
      assert.notEqual(
        (term as any)._bufferService.buffers.active.lines.get(0)._extendedAttrs[1],
        (term as any)._bufferService.buffers.active.lines.get(0)._extendedAttrs[3]
      );
    });
  });
});
