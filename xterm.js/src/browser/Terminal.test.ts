/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { MockViewport, MockCompositionHelper, MockRenderer, TestTerminal } from 'browser/TestUtils.test';
import { DEFAULT_ATTR_DATA } from 'common/buffer/BufferLine';
import { CellData } from 'common/buffer/CellData';
import { IBufferService, IUnicodeService } from 'common/services/Services';
import { Linkifier } from 'browser/Linkifier';
import { MockLogService, MockUnicodeService } from 'common/TestUtils.test';
import { IRegisteredLinkMatcher, IMouseZoneManager, IMouseZone } from 'browser/Types';
import { IMarker } from 'common/Types';

const INIT_COLS = 80;
const INIT_ROWS = 24;

// grab wcwidth from mock unicode service (hardcoded to V6)
const wcwidth = (new MockUnicodeService()).wcwidth;

describe('Terminal', () => {
  let term: TestTerminal;
  const termOptions = {
    cols: INIT_COLS,
    rows: INIT_ROWS
  };

  beforeEach(() => {
    term = new TestTerminal(termOptions);
    term.refresh = () => { };
    (term as any).renderer = new MockRenderer();
    term.viewport = new MockViewport();
    (term as any)._compositionHelper = new MockCompositionHelper();
    (term as any).element = {
      classList: {
        toggle: () => { },
        remove: () => { }
      }
    };
  });

  it('should not mutate the options parameter', () => {
    term.options.cols = 1000;

    assert.deepEqual(termOptions, {
      cols: INIT_COLS,
      rows: INIT_ROWS
    });
  });

  describe('events', () => {
    // TODO: Add an onData test back
    // it('should fire the onData evnet', (done) => {
    //   term.onData(() => done());
    //   term.handler('fake');
    // });
    it('should fire the onCursorMove event', () => {
      return new Promise<void>(async r => {
        term.onCursorMove(() => r());
        await term.writeP('foo');
      });
    });
    it('should fire the onLineFeed event', () => {
      return new Promise<void>(async r => {
        term.onLineFeed(() => r());
        await term.writeP('\n');
      });
    });
    it('should fire a scroll event when scrollback is created', () => {
      return new Promise<void>(async r => {
        term.onScroll(() => r());
        await term.writeP('\n'.repeat(INIT_ROWS));
      });
    });
    it('should fire a scroll event when scrollback is cleared', () => {
      return new Promise<void>(async r => {
        await term.writeP('\n'.repeat(INIT_ROWS));
        term.onScroll(() => r());
        term.clear();
      });
    });
    it('should fire a key event after a keypress DOM event', (done) => {
      term.onKey(e => {
        assert.equal(typeof e.key, 'string');
        assert.equal(e.domEvent instanceof Object, true);
        done();
      });
      const evKeyPress = {
        preventDefault: () => { },
        stopPropagation: () => { },
        type: 'keypress',
        keyCode: 13
      } as KeyboardEvent;
      term.keyPress(evKeyPress);
    });
    it('should fire a key event after a keydown DOM event', (done) => {
      term.onKey(e => {
        assert.equal(typeof e.key, 'string');
        assert.equal(e.domEvent instanceof Object, true);
        done();
      });
      (term as any).textarea = { value: '' };
      const evKeyDown = {
        preventDefault: () => { },
        stopPropagation: () => { },
        type: 'keydown',
        keyCode: 13
      } as KeyboardEvent;
      term.keyDown(evKeyDown);
    });
    it('should fire the onResize event', (done) => {
      term.onResize(e => {
        assert.equal(typeof e.cols, 'number');
        assert.equal(typeof e.rows, 'number');
        done();
      });
      term.resize(1, 1);
    });
    it('should fire the onScroll event', (done) => {
      term.onScroll(e => {
        assert.equal(typeof e, 'number');
        done();
      });
      term.scroll(DEFAULT_ATTR_DATA.clone());
    });
    it('should fire the onTitleChange event', (done) => {
      term.onTitleChange(e => {
        assert.equal(e, 'title');
        done();
      });
      term.write('\x1b]2;title\x07');
    });
    it('should fire the onBell event', (done) => {
      term.onBell(e => {
        done();
      });
      term.write('\x07');
    });
  });

  describe('attachCustomKeyEventHandler', () => {
    const evKeyDown = {
      preventDefault: () => { },
      stopPropagation: () => { },
      type: 'keydown',
      keyCode: 77
    } as KeyboardEvent;
    const evKeyPress = {
      preventDefault: () => { },
      stopPropagation: () => { },
      type: 'keypress',
      keyCode: 77
    } as KeyboardEvent;

    beforeEach(() => {
      term.clearSelection = () => { };
    });

    it('should process the keydown/keypress event based on what the handler returns', () => {
      assert.equal(term.keyDown(evKeyDown), true);
      assert.equal(term.keyPress(evKeyPress), true);
      term.attachCustomKeyEventHandler(ev => ev.keyCode === 77);
      assert.equal(term.keyDown(evKeyDown), true);
      assert.equal(term.keyPress(evKeyPress), true);
      term.attachCustomKeyEventHandler(ev => ev.keyCode !== 77);
      assert.equal(term.keyDown(evKeyDown), false);
      assert.equal(term.keyPress(evKeyPress), false);
    });

    it('should alive after reset(ESC c Full Reset (RIS))', () => {
      term.attachCustomKeyEventHandler(ev => ev.keyCode !== 77);
      assert.equal(term.keyDown(evKeyDown), false);
      assert.equal(term.keyPress(evKeyPress), false);
      term.reset();
      assert.equal(term.keyDown(evKeyDown), false);
      assert.equal(term.keyPress(evKeyPress), false);
    });
  });

  describe('clear', () => {
    it('should clear a buffer equal to rows', () => {
      const promptLine = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
      term.clear();
      assert.equal(term.buffer.y, 0);
      assert.equal(term.buffer.ybase, 0);
      assert.equal(term.buffer.ydisp, 0);
      assert.equal(term.buffer.lines.length, term.rows);
      assert.deepEqual(term.buffer.lines.get(0), promptLine);
      for (let i = 1; i < term.rows; i++) {
        assert.deepEqual(term.buffer.lines.get(i), term.buffer.getBlankLine(DEFAULT_ATTR_DATA));
      }
    });
    it('should clear a buffer larger than rows', async () => {
      // Fill the buffer with dummy rows
      for (let i = 0; i < term.rows * 2; i++) {
        await term.writeP('test\n');
      }

      const promptLine = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
      term.clear();
      assert.equal(term.buffer.y, 0);
      assert.equal(term.buffer.ybase, 0);
      assert.equal(term.buffer.ydisp, 0);
      assert.equal(term.buffer.lines.length, term.rows);
      assert.deepEqual(term.buffer.lines.get(0), promptLine);
      for (let i = 1; i < term.rows; i++) {
        assert.deepEqual(term.buffer.lines.get(i), term.buffer.getBlankLine(DEFAULT_ATTR_DATA));
      }
    });
    it('should not break the prompt when cleared twice', () => {
      const promptLine = term.buffer.lines.get(term.buffer.ybase + term.buffer.y);
      term.clear();
      term.clear();
      assert.equal(term.buffer.y, 0);
      assert.equal(term.buffer.ybase, 0);
      assert.equal(term.buffer.ydisp, 0);
      assert.equal(term.buffer.lines.length, term.rows);
      assert.deepEqual(term.buffer.lines.get(0), promptLine);
      for (let i = 1; i < term.rows; i++) {
        assert.deepEqual(term.buffer.lines.get(i), term.buffer.getBlankLine(DEFAULT_ATTR_DATA));
      }
    });
  });

  describe('paste', () => {
    it('should fire data event', done => {
      term.onData(e => {
        assert.equal(e, 'foo');
        done();
      });
      term.paste('foo');
    });
    it('should sanitize \n chars', done => {
      term.onData(e => {
        assert.equal(e, '\rfoo\rbar\r');
        done();
      });
      term.paste('\r\nfoo\nbar\r');
    });
    it('should respect bracketed paste mode', () => {
      return new Promise<void>(async r => {
        term.onData(e => {
          assert.equal(e, '\x1b[200~foo\x1b[201~');
          r();
        });
        await term.writeP('\x1b[?2004h');
        term.paste('foo');
      });
    });
  });

  describe('scroll', () => {
    describe('scrollLines', () => {
      let startYDisp: number;
      beforeEach(async () => {
        for (let i = 0; i < INIT_ROWS * 2; i++) {
          await term.writeP('test\r\n');
        }
        startYDisp = INIT_ROWS + 1;
      });
      it('should scroll a single line', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollLines(-1);
        assert.equal(term.buffer.ydisp, startYDisp - 1);
        term.scrollLines(1);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
      it('should scroll multiple lines', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollLines(-5);
        assert.equal(term.buffer.ydisp, startYDisp - 5);
        term.scrollLines(5);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
      it('should not scroll beyond the bounds of the buffer', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollLines(1);
        assert.equal(term.buffer.ydisp, startYDisp);
        for (let i = 0; i < startYDisp; i++) {
          term.scrollLines(-1);
        }
        assert.equal(term.buffer.ydisp, 0);
        term.scrollLines(-1);
        assert.equal(term.buffer.ydisp, 0);
      });
    });

    describe('scrollPages', () => {
      let startYDisp: number;
      beforeEach(async () => {
        for (let i = 0; i < term.rows * 3; i++) {
          await term.writeP('test\r\n');
        }
        startYDisp = (term.rows * 2) + 1;
      });
      it('should scroll a single page', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollPages(-1);
        assert.equal(term.buffer.ydisp, startYDisp - (term.rows - 1));
        term.scrollPages(1);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
      it('should scroll a multiple pages', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollPages(-2);
        assert.equal(term.buffer.ydisp, startYDisp - (term.rows - 1) * 2);
        term.scrollPages(2);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
    });

    describe('scrollToTop', () => {
      beforeEach(async () => {
        for (let i = 0; i < term.rows * 3; i++) {
          await term.writeP('test\r\n');
        }
      });
      it('should scroll to the top', () => {
        assert.notEqual(term.buffer.ydisp, 0);
        term.scrollToTop();
        assert.equal(term.buffer.ydisp, 0);
      });
    });

    describe('scrollToBottom', () => {
      let startYDisp: number;
      beforeEach(async () => {
        for (let i = 0; i < term.rows * 3; i++) {
          await term.writeP('test\r\n');
        }
        startYDisp = (term.rows * 2) + 1;
      });
      it('should scroll to the bottom', () => {
        term.scrollLines(-1);
        term.scrollToBottom();
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollPages(-1);
        term.scrollToBottom();
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollToTop();
        term.scrollToBottom();
        assert.equal(term.buffer.ydisp, startYDisp);
      });
    });

    describe('scrollToLine', () => {
      let startYDisp: number;
      beforeEach(async () => {
        for (let i = 0; i < term.rows * 3; i++) {
          await term.writeP('test\r\n');
        }
        startYDisp = (term.rows * 2) + 1;
      });
      it('should scroll to requested line', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollToLine(0);
        assert.equal(term.buffer.ydisp, 0);
        term.scrollToLine(10);
        assert.equal(term.buffer.ydisp, 10);
        term.scrollToLine(startYDisp);
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollToLine(20);
        assert.equal(term.buffer.ydisp, 20);
      });
      it('should not scroll beyond boundary lines', () => {
        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollToLine(-1);
        assert.equal(term.buffer.ydisp, 0);
        term.scrollToLine(startYDisp + 1);
        assert.equal(term.buffer.ydisp, startYDisp);
      });
    });

    describe('keyPress', () => {
      it('should scroll down, when a key is pressed and terminal is scrolled up', () => {
        const event = {
          type: 'keydown',
          key: 'a',
          keyCode: 65,
          preventDefault: () => { },
          stopPropagation: () => { }
        } as KeyboardEvent;

        term.buffer.ydisp = 0;
        term.buffer.ybase = 40;
        term.keyPress(event);

        // Ensure that now the terminal is scrolled to bottom
        assert.equal(term.buffer.ydisp, term.buffer.ybase);
      });

      it('should not scroll down, when a custom keydown handler prevents the event', async () => {
        // Add some output to the terminal
        for (let i = 0; i < term.rows * 3; i++) {
          await term.writeP('test\r\n');
        }
        const startYDisp = (term.rows * 2) + 1;
        term.attachCustomKeyEventHandler(() => {
          return false;
        });

        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollLines(-1);
        assert.equal(term.buffer.ydisp, startYDisp - 1);
        term.keyPress({ keyCode: 0 });
        assert.equal(term.buffer.ydisp, startYDisp - 1);
      });
    });

    describe('scroll() function', () => {
      describe('when scrollback > 0', () => {
        it('should create a new line and scroll', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(INIT_ROWS - 1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS + 1);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 1)!.loadCell(0, new CellData()).getChars(), 'b');
          assert.equal(term.buffer.lines.get(INIT_ROWS)!.loadCell(0, new CellData()).getChars(), '');
        });

        it('should properly scroll inside a scroll region (scrollTop set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'c');
        });

        it('should properly scroll inside a scroll region (scrollBottom set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.lines.get(3)!.setCell(0, CellData.fromCharData([0, 'd', 0, 'd'.charCodeAt(0)]));
          term.buffer.lines.get(4)!.setCell(0, CellData.fromCharData([0, 'e', 0, 'e'.charCodeAt(0)]));
          term.buffer.y = 3;
          term.buffer.scrollBottom = 3;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS + 1);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a', '\'a\' should be pushed to the scrollback');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'b');
          assert.equal(term.buffer.lines.get(2)!.loadCell(0, new CellData()).getChars(), 'c');
          assert.equal(term.buffer.lines.get(3)!.loadCell(0, new CellData()).getChars(), 'd');
          assert.equal(term.buffer.lines.get(4)!.loadCell(0, new CellData()).getChars(), '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(5)!.loadCell(0, new CellData()).getChars(), 'e');
        });

        it('should properly scroll inside a scroll region (scrollTop and scrollBottom set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.lines.get(3)!.setCell(0, CellData.fromCharData([0, 'd', 0, 'd'.charCodeAt(0)]));
          term.buffer.lines.get(4)!.setCell(0, CellData.fromCharData([0, 'e', 0, 'e'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.buffer.scrollBottom = 3;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'c', '\'b\' should be removed from the buffer');
          assert.equal(term.buffer.lines.get(2)!.loadCell(0, new CellData()).getChars(), 'd');
          assert.equal(term.buffer.lines.get(3)!.loadCell(0, new CellData()).getChars(), '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4)!.loadCell(0, new CellData()).getChars(), 'e');
        });
      });

      describe('when scrollback === 0', () => {
        beforeEach(() => {
          term.optionsService.setOption('scrollback', 0);
          assert.equal(term.buffer.lines.maxLength, INIT_ROWS);
        });

        it('should create a new line and shift everything up', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(INIT_ROWS - 1)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          // 'a' gets pushed out of buffer
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'b');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), '');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 2)!.loadCell(0, new CellData()).getChars(), 'c');
          assert.equal(term.buffer.lines.get(INIT_ROWS - 1)!.loadCell(0, new CellData()).getChars(), '');
        });

        it('should properly scroll inside a scroll region (scrollTop set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'c');
        });

        it('should properly scroll inside a scroll region (scrollBottom set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.lines.get(3)!.setCell(0, CellData.fromCharData([0, 'd', 0, 'd'.charCodeAt(0)]));
          term.buffer.lines.get(4)!.setCell(0, CellData.fromCharData([0, 'e', 0, 'e'.charCodeAt(0)]));
          term.buffer.y = 3;
          term.buffer.scrollBottom = 3;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'b');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'c');
          assert.equal(term.buffer.lines.get(2)!.loadCell(0, new CellData()).getChars(), 'd');
          assert.equal(term.buffer.lines.get(3)!.loadCell(0, new CellData()).getChars(), '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4)!.loadCell(0, new CellData()).getChars(), 'e');
        });

        it('should properly scroll inside a scroll region (scrollTop and scrollBottom set)', () => {
          term.buffer.lines.get(0)!.setCell(0, CellData.fromCharData([0, 'a', 0, 'a'.charCodeAt(0)]));
          term.buffer.lines.get(1)!.setCell(0, CellData.fromCharData([0, 'b', 0, 'b'.charCodeAt(0)]));
          term.buffer.lines.get(2)!.setCell(0, CellData.fromCharData([0, 'c', 0, 'c'.charCodeAt(0)]));
          term.buffer.lines.get(3)!.setCell(0, CellData.fromCharData([0, 'd', 0, 'd'.charCodeAt(0)]));
          term.buffer.lines.get(4)!.setCell(0, CellData.fromCharData([0, 'e', 0, 'e'.charCodeAt(0)]));
          term.buffer.y = INIT_ROWS - 1; // Move cursor to last line
          term.buffer.scrollTop = 1;
          term.buffer.scrollBottom = 3;
          term.scroll(DEFAULT_ATTR_DATA.clone());
          assert.equal(term.buffer.lines.length, INIT_ROWS);
          assert.equal(term.buffer.lines.get(0)!.loadCell(0, new CellData()).getChars(), 'a');
          assert.equal(term.buffer.lines.get(1)!.loadCell(0, new CellData()).getChars(), 'c', '\'b\' should be removed from the buffer');
          assert.equal(term.buffer.lines.get(2)!.loadCell(0, new CellData()).getChars(), 'd');
          assert.equal(term.buffer.lines.get(3)!.loadCell(0, new CellData()).getChars(), '', 'a blank line should be added at scrollBottom\'s index');
          assert.equal(term.buffer.lines.get(4)!.loadCell(0, new CellData()).getChars(), 'e');
        });
      });
    });
  });

  describe('Third level shift', () => {
    let evKeyDown: any;
    let evKeyPress: any;

    beforeEach(() => {
      term.clearSelection = () => { };
      // term.compositionHelper = {
      //   isComposing: false,
      //   keydown: {
      //     bind: () => {
      //       return () => { return true; };
      //     }
      //   }
      // };
      evKeyDown = {
        preventDefault: () => { },
        stopPropagation: () => { },
        type: 'keydown',
        altKey: null,
        keyCode: null
      };
      evKeyPress = {
        preventDefault: () => { },
        stopPropagation: () => { },
        type: 'keypress',
        altKey: null,
        charCode: null,
        keyCode: null
      };
    });

    describe('with macOptionIsMeta', () => {
      let originalIsMac: boolean;
      beforeEach(() => {
        originalIsMac = term.browser.isMac;
        term.options.macOptionIsMeta = true;
      });
      afterEach(() => term.browser.isMac = originalIsMac);

      it('should interfere with the alt key on keyDown', () => {
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 81;
        assert.equal(term.keyDown(evKeyDown), false);
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 192;
        assert.equal(term.keyDown(evKeyDown), false);
      });
    });

    describe('On Mac OS', () => {
      let originalIsMac: boolean;
      beforeEach(() => {
        originalIsMac = term.browser.isMac;
        term.browser.isMac = true;
      });
      afterEach(() => term.browser.isMac = originalIsMac);

      it('should not interfere with the alt key on keyDown', () => {
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 81;
        assert.equal(term.keyDown(evKeyDown), true);
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 192;
        term.keyDown(evKeyDown);
        assert.equal(term.keyDown(evKeyDown), true);
      });

      it('should interfere with the alt + arrow keys', () => {
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 37;
        assert.equal(term.keyDown(evKeyDown), false);
        evKeyDown.altKey = true;
        evKeyDown.keyCode = 39;
        assert.equal(term.keyDown(evKeyDown), false);
      });

      it('should emit key with alt + key on keyPress', (done) => {
        const keys = ['@', '@', '\\', '\\', '|', '|'];

        term.onKey(e => {
          if (e.key) {
            const index = keys.indexOf(e.key);
            assert(index !== -1, 'Emitted wrong key: ' + e.key);
            keys.splice(index, 1);
          }
          if (keys.length === 0) done();
        });

        evKeyPress.altKey = true;
        // @
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 64;
        term.keyPress(evKeyPress);
        // Firefox @
        evKeyPress.charCode = 64;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
        // \
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 92;
        term.keyPress(evKeyPress);
        // Firefox \
        evKeyPress.charCode = 92;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
        // |
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 124;
        term.keyPress(evKeyPress);
        // Firefox |
        evKeyPress.charCode = 124;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
      });
    });

    describe('On MS Windows', () => {
      let originalIsWindows: boolean;
      beforeEach(() => {
        originalIsWindows = term.browser.isWindows;
        term.browser.isWindows = true;
      });
      afterEach(() => term.browser.isWindows = originalIsWindows);

      it('should not interfere with the alt + ctrl key on keyDown', () => {
        evKeyPress.altKey = true;
        evKeyPress.ctrlKey = true;
        evKeyPress.keyCode = 81;
        assert.equal(term.keyDown(evKeyPress), true);
        evKeyDown.altKey = true;
        evKeyDown.ctrlKey = true;
        evKeyDown.keyCode = 81;
        term.keyDown(evKeyDown);
        assert.equal(term.keyDown(evKeyPress), true);
      });

      it('should interfere with the alt + ctrl + arrow keys', () => {
        evKeyDown.altKey = true;
        evKeyDown.ctrlKey = true;

        evKeyDown.keyCode = 37;
        assert.equal(term.keyDown(evKeyDown), false);
        evKeyDown.keyCode = 39;
        term.keyDown(evKeyDown);
        assert.equal(term.keyDown(evKeyDown), false);
      });

      it('should emit key with alt + ctrl + key on keyPress', (done) => {
        const keys = ['@', '@', '\\', '\\', '|', '|'];

        term.onKey(e => {
          if (e.key) {
            const index = keys.indexOf(e.key);
            assert(index !== -1, 'Emitted wrong key: ' + e.key);
            keys.splice(index, 1);
          }
          if (keys.length === 0) done();
        });

        evKeyPress.altKey = true;
        evKeyPress.ctrlKey = true;

        // @
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 64;
        term.keyPress(evKeyPress);
        // Firefox @
        evKeyPress.charCode = 64;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
        // \
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 92;
        term.keyPress(evKeyPress);
        // Firefox \
        evKeyPress.charCode = 92;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
        // |
        evKeyPress.charCode = null;
        evKeyPress.keyCode = 124;
        term.keyPress(evKeyPress);
        // Firefox |
        evKeyPress.charCode = 124;
        evKeyPress.keyCode = 0;
        term.keyPress(evKeyPress);
      });
    });
  });

  describe('unicode - surrogates', () => {
    it('2 characters per cell', async function (): Promise<void> {
      this.timeout(10000);  // This is needed because istanbul patches code and slows it down
      const high = String.fromCharCode(0xD800);
      const cell = new CellData();
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        await term.writeP(high + String.fromCharCode(i));
        const tchar = term.buffer.lines.get(0)!.loadCell(0, cell);
        assert.equal(tchar.getChars(), high + String.fromCharCode(i));
        assert.equal(tchar.getChars().length, 2);
        assert.equal(tchar.getWidth(), 1);
        assert.equal(term.buffer.lines.get(0)!.loadCell(1, cell).getChars(), '');
        term.reset();
      }
    });
    it('2 characters at last cell', async () => {
      const high = String.fromCharCode(0xD800);
      const cell = new CellData();
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;
        await term.writeP(high + String.fromCharCode(i));
        assert.equal(term.buffer.lines.get(0)!.loadCell(term.buffer.x - 1, cell).getChars(), high + String.fromCharCode(i));
        assert.equal(term.buffer.lines.get(0)!.loadCell(term.buffer.x - 1, cell).getChars().length, 2);
        assert.equal(term.buffer.lines.get(1)!.loadCell(0, cell).getChars(), '');
        term.reset();
      }
    });
    it('2 characters per cell over line end with autowrap', async function (): Promise<void> {
      this.timeout(10000);
      const high = String.fromCharCode(0xD800);
      const cell = new CellData();
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;

        await term.writeP('a' + high + String.fromCharCode(i));
        assert.equal(term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell).getChars(), 'a');
        assert.equal(term.buffer.lines.get(1)!.loadCell(0, cell).getChars(), high + String.fromCharCode(i));
        assert.equal(term.buffer.lines.get(1)!.loadCell(0, cell).getChars().length, 2);
        assert.equal(term.buffer.lines.get(1)!.loadCell(1, cell).getChars(), '');
        term.reset();
      }
    });
    it('2 characters per cell over line end without autowrap', async function (): Promise<void> {
      this.timeout(10000);
      const high = String.fromCharCode(0xD800);
      const cell = new CellData();
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;
        await term.writeP('\x1b[?7l'); // Disable wraparound mode
        const width = wcwidth((0xD800 - 0xD800) * 0x400 + i - 0xDC00 + 0x10000);
        if (width !== 1) {
          continue;
        }
        await term.writeP('a' + high + String.fromCharCode(i));
        // auto wraparound mode should cut off the rest of the line
        assert.equal(term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell).getChars(), high + String.fromCharCode(i));
        assert.equal(term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell).getChars().length, 2);
        assert.equal(term.buffer.lines.get(1)!.loadCell(1, cell).getChars(), '');
        term.reset();
      }
    });
    it('splitted surrogates', async function (): Promise<void> {
      this.timeout(10000);
      const high = String.fromCharCode(0xD800);
      const cell = new CellData();
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        await term.writeP(high + String.fromCharCode(i));
        const tchar = term.buffer.lines.get(0)!.loadCell(0, cell);
        assert.equal(tchar.getChars(), high + String.fromCharCode(i));
        assert.equal(tchar.getChars().length, 2);
        assert.equal(tchar.getWidth(), 1);
        assert.equal(term.buffer.lines.get(0)!.loadCell(1, cell).getChars(), '');
        term.reset();
      }
    });
  });

  describe('unicode - combining characters', () => {
    const cell = new CellData();
    it('café', async () => {
      await term.writeP('cafe\u0301');
      term.buffer.lines.get(0)!.loadCell(3, cell);
      assert.equal(cell.getChars(), 'e\u0301');
      assert.equal(cell.getChars().length, 2);
      assert.equal(cell.getWidth(), 1);
    });
    it('café - end of line', async () => {
      term.buffer.x = term.cols - 1 - 3;
      await term.writeP('cafe\u0301');
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      assert.equal(cell.getChars(), 'e\u0301');
      assert.equal(cell.getChars().length, 2);
      assert.equal(cell.getWidth(), 1);
      term.buffer.lines.get(0)!.loadCell(1, cell);
      assert.equal(cell.getChars(), '');
      assert.equal(cell.getChars().length, 0);
      assert.equal(cell.getWidth(), 1);
    });
    it('multiple combined é', async () => {
      await term.writeP(Array(100).join('e\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        assert.equal(cell.getChars(), 'e\u0301');
        assert.equal(cell.getChars().length, 2);
        assert.equal(cell.getWidth(), 1);
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), 'e\u0301');
      assert.equal(cell.getChars().length, 2);
      assert.equal(cell.getWidth(), 1);
    });
    it('multiple surrogate with combined', async () => {
      await term.writeP(Array(100).join('\uD800\uDC00\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        assert.equal(cell.getChars(), '\uD800\uDC00\u0301');
        assert.equal(cell.getChars().length, 3);
        assert.equal(cell.getWidth(), 1);
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '\uD800\uDC00\u0301');
      assert.equal(cell.getChars().length, 3);
      assert.equal(cell.getWidth(), 1);
    });
  });

  describe('unicode - fullwidth characters', () => {
    const cell = new CellData();
    it('cursor movement even', async () => {
      assert.equal(term.buffer.x, 0);
      await term.writeP('￥');
      assert.equal(term.buffer.x, 2);
    });
    it('cursor movement odd', async () => {
      term.buffer.x = 1;
      assert.equal(term.buffer.x, 1);
      await term.writeP('￥');
      assert.equal(term.buffer.x, 3);
    });
    it('line of ￥ even', async () => {
      await term.writeP(Array(50).join('￥'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (i % 2) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '￥');
          assert.equal(cell.getChars().length, 1);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '￥');
      assert.equal(cell.getChars().length, 1);
      assert.equal(cell.getWidth(), 2);
    });
    it('line of ￥ odd', async () => {
      term.buffer.x = 1;
      await term.writeP(Array(50).join('￥'));
      for (let i = 1; i < term.cols - 1; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (!(i % 2)) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '￥');
          assert.equal(cell.getChars().length, 1);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      assert.equal(cell.getChars(), '');
      assert.equal(cell.getChars().length, 0);
      assert.equal(cell.getWidth(), 1);
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '￥');
      assert.equal(cell.getChars().length, 1);
      assert.equal(cell.getWidth(), 2);
    });
    it('line of ￥ with combining odd', async () => {
      term.buffer.x = 1;
      await term.writeP(Array(50).join('￥\u0301'));
      for (let i = 1; i < term.cols - 1; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (!(i % 2)) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '￥\u0301');
          assert.equal(cell.getChars().length, 2);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      assert.equal(cell.getChars(), '');
      assert.equal(cell.getChars().length, 0);
      assert.equal(cell.getWidth(), 1);
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '￥\u0301');
      assert.equal(cell.getChars().length, 2);
      assert.equal(cell.getWidth(), 2);
    });
    it('line of ￥ with combining even', async () => {
      await term.writeP(Array(50).join('￥\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (i % 2) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '￥\u0301');
          assert.equal(cell.getChars().length, 2);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '￥\u0301');
      assert.equal(cell.getChars().length, 2);
      assert.equal(cell.getWidth(), 2);
    });
    it('line of surrogate fullwidth with combining odd', async () => {
      term.buffer.x = 1;
      await term.writeP(Array(50).join('\ud843\ude6d\u0301'));
      for (let i = 1; i < term.cols - 1; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (!(i % 2)) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '\ud843\ude6d\u0301');
          assert.equal(cell.getChars().length, 3);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      assert.equal(cell.getChars(), '');
      assert.equal(cell.getChars().length, 0);
      assert.equal(cell.getWidth(), 1);
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '\ud843\ude6d\u0301');
      assert.equal(cell.getChars().length, 3);
      assert.equal(cell.getWidth(), 2);
    });
    it('line of surrogate fullwidth with combining even', async () => {
      await term.writeP(Array(50).join('\ud843\ude6d\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (i % 2) {
          assert.equal(cell.getChars(), '');
          assert.equal(cell.getChars().length, 0);
          assert.equal(cell.getWidth(), 0);
        } else {
          assert.equal(cell.getChars(), '\ud843\ude6d\u0301');
          assert.equal(cell.getChars().length, 3);
          assert.equal(cell.getWidth(), 2);
        }
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      assert.equal(cell.getChars(), '\ud843\ude6d\u0301');
      assert.equal(cell.getChars().length, 3);
      assert.equal(cell.getWidth(), 2);
    });
  });

  describe('insert mode', () => {
    const cell = new CellData();
    it('halfwidth - all', async () => {
      await term.writeP(Array(9).join('0123456789').slice(-80));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.write('\x1b[4h');
      await term.writeP('abcde');
      assert.equal(term.buffer.lines.get(0)!.length, term.cols);
      assert.equal(term.buffer.lines.get(0)!.loadCell(10, cell).getChars(), 'a');
      assert.equal(term.buffer.lines.get(0)!.loadCell(14, cell).getChars(), 'e');
      assert.equal(term.buffer.lines.get(0)!.loadCell(15, cell).getChars(), '0');
      assert.equal(term.buffer.lines.get(0)!.loadCell(79, cell).getChars(), '4');
    });
    it('fullwidth - insert', async () => {
      await term.writeP(Array(9).join('0123456789').slice(-80));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.write('\x1b[4h');
      await term.writeP('￥￥￥');
      assert.equal(term.buffer.lines.get(0)!.length, term.cols);
      assert.equal(term.buffer.lines.get(0)!.loadCell(10, cell).getChars(), '￥');
      assert.equal(term.buffer.lines.get(0)!.loadCell(11, cell).getChars(), '');
      assert.equal(term.buffer.lines.get(0)!.loadCell(14, cell).getChars(), '￥');
      assert.equal(term.buffer.lines.get(0)!.loadCell(15, cell).getChars(), '');
      assert.equal(term.buffer.lines.get(0)!.loadCell(79, cell).getChars(), '3');
    });
    it('fullwidth - right border', async () => {
      await term.writeP(Array(41).join('￥'));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.write('\x1b[4h');
      await term.writeP('a');
      assert.equal(term.buffer.lines.get(0)!.length, term.cols);
      assert.equal(term.buffer.lines.get(0)!.loadCell(10, cell).getChars(), 'a');
      assert.equal(term.buffer.lines.get(0)!.loadCell(11, cell).getChars(), '￥');
      assert.equal(term.buffer.lines.get(0)!.loadCell(79, cell).getChars(), '');  // fullwidth char got replaced
      await term.writeP('b');
      assert.equal(term.buffer.lines.get(0)!.length, term.cols);
      assert.equal(term.buffer.lines.get(0)!.loadCell(11, cell).getChars(), 'b');
      assert.equal(term.buffer.lines.get(0)!.loadCell(12, cell).getChars(), '￥');
      assert.equal(term.buffer.lines.get(0)!.loadCell(79, cell).getChars(), '');  // empty cell after fullwidth
    });
  });

  describe('Linkifier unicode handling', () => {
    let terminal: TestTerminal;
    let linkifier: TestLinkifier;
    let mouseZoneManager: TestMouseZoneManager;

    // other than the tests above unicode testing needs the full terminal instance
    // to get the special handling of fullwidth, surrogate and combining chars in the input handler
    beforeEach(() => {
      terminal = new TestTerminal({ cols: 10, rows: 5 });
      linkifier = new TestLinkifier((terminal as any)._bufferService, terminal.unicodeService);
      mouseZoneManager = new TestMouseZoneManager();
      linkifier.attachToDom({} as any, mouseZoneManager);
    });

    function assertLinkifiesInTerminal(rowText: string, linkMatcherRegex: RegExp, links: { x1: number, y1: number, x2: number, y2: number }[]): Promise<void> {
      return new Promise(async r => {
        await terminal.writeP(rowText);
        linkifier.registerLinkMatcher(linkMatcherRegex, () => { });
        linkifier.linkifyRows();
        // Allow linkify to happen
        setTimeout(() => {
          assert.equal(mouseZoneManager.zones.length, links.length);
          links.forEach((l, i) => {
            assert.equal(mouseZoneManager.zones[i].x1, l.x1 + 1);
            assert.equal(mouseZoneManager.zones[i].x2, l.x2 + 1);
            assert.equal(mouseZoneManager.zones[i].y1, l.y1 + 1);
            assert.equal(mouseZoneManager.zones[i].y2, l.y2 + 1);
          });
          r();
        }, 0);
      });
    }

    describe('unicode before the match', () => {
      it('combining - match within one line', () => {
        return assertLinkifiesInTerminal('e\u0301e\u0301e\u0301 foo', /foo/, [{ x1: 4, x2: 7, y1: 0, y2: 0 }]);
      });
      it('combining - match over two lines', () => {
        return assertLinkifiesInTerminal('e\u0301e\u0301e\u0301     foo', /foo/, [{ x1: 8, x2: 1, y1: 0, y2: 1 }]);
      });
      it('surrogate - match within one line', () => {
        return assertLinkifiesInTerminal('𝄞𝄞𝄞 foo', /foo/, [{ x1: 4, x2: 7, y1: 0, y2: 0 }]);
      });
      it('surrogate - match over two lines', () => {
        return assertLinkifiesInTerminal('𝄞𝄞𝄞     foo', /foo/, [{ x1: 8, x2: 1, y1: 0, y2: 1 }]);
      });
      it('combining surrogate - match within one line', () => {
        return assertLinkifiesInTerminal('𓂀\u0301𓂀\u0301𓂀\u0301 foo', /foo/, [{ x1: 4, x2: 7, y1: 0, y2: 0 }]);
      });
      it('combining surrogate - match over two lines', () => {
        return assertLinkifiesInTerminal('𓂀\u0301𓂀\u0301𓂀\u0301     foo', /foo/, [{ x1: 8, x2: 1, y1: 0, y2: 1 }]);
      });
      it('fullwidth - match within one line', () => {
        return assertLinkifiesInTerminal('１２ foo', /foo/, [{ x1: 5, x2: 8, y1: 0, y2: 0 }]);
      });
      it('fullwidth - match over two lines', () => {
        return assertLinkifiesInTerminal('１２    foo', /foo/, [{ x1: 8, x2: 1, y1: 0, y2: 1 }]);
      });
      it('combining fullwidth - match within one line', () => {
        return assertLinkifiesInTerminal('￥\u0301￥\u0301 foo', /foo/, [{ x1: 5, x2: 8, y1: 0, y2: 0 }]);
      });
      it('combining fullwidth - match over two lines', () => {
        return assertLinkifiesInTerminal('￥\u0301￥\u0301    foo', /foo/, [{ x1: 8, x2: 1, y1: 0, y2: 1 }]);
      });
    });
    describe('unicode within the match', () => {
      it('combining - match within one line', () => {
        return assertLinkifiesInTerminal('test cafe\u0301', /cafe\u0301/, [{ x1: 5, x2: 9, y1: 0, y2: 0 }]);
      });
      it('combining - match over two lines', () => {
        return assertLinkifiesInTerminal('testtest cafe\u0301', /cafe\u0301/, [{ x1: 9, x2: 3, y1: 0, y2: 1 }]);
      });
      it('surrogate - match within one line', () => {
        return assertLinkifiesInTerminal('test a𝄞b', /a𝄞b/, [{ x1: 5, x2: 8, y1: 0, y2: 0 }]);
      });
      it('surrogate - match over two lines', () => {
        return assertLinkifiesInTerminal('testtest a𝄞b', /a𝄞b/, [{ x1: 9, x2: 2, y1: 0, y2: 1 }]);
      });
      it('combining surrogate - match within one line', () => {
        return assertLinkifiesInTerminal('test a𓂀\u0301b', /a𓂀\u0301b/, [{ x1: 5, x2: 8, y1: 0, y2: 0 }]);
      });
      it('combining surrogate - match over two lines', () => {
        return assertLinkifiesInTerminal('testtest a𓂀\u0301b', /a𓂀\u0301b/, [{ x1: 9, x2: 2, y1: 0, y2: 1 }]);
      });
      it('fullwidth - match within one line', () => {
        return assertLinkifiesInTerminal('test a１b', /a１b/, [{ x1: 5, x2: 9, y1: 0, y2: 0 }]);
      });
      it('fullwidth - match over two lines', () => {
        return assertLinkifiesInTerminal('testtest a１b', /a１b/, [{ x1: 9, x2: 3, y1: 0, y2: 1 }]);
      });
      it('combining fullwidth - match within one line', () => {
        return assertLinkifiesInTerminal('test a￥\u0301b', /a￥\u0301b/, [{ x1: 5, x2: 9, y1: 0, y2: 0 }]);
      });
      it('combining fullwidth - match over two lines', () => {
        return assertLinkifiesInTerminal('testtest a￥\u0301b', /a￥\u0301b/, [{ x1: 9, x2: 3, y1: 0, y2: 1 }]);
      });
    });
  });

  describe('Buffer.stringIndexToBufferIndex', () => {
    let terminal: TestTerminal;

    beforeEach(() => {
      terminal = new TestTerminal({ rows: 5, cols: 10, scrollback: 5 });
    });

    it('multiline ascii', async () => {
      const input = 'This is ASCII text spanning multiple lines.';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(i / terminal.cols) | 0, i % terminal.cols], bufferIndex);
      }
    });

    it('combining e\u0301 in a sentence', async () => {
      const input = 'Sitting in the cafe\u0301 drinking coffee.';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < 19; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(i / terminal.cols) | 0, i % terminal.cols], bufferIndex);
      }
      // string index 18 & 19 point to combining char e\u0301 ---> same buffer Index
      assert.deepEqual(
        terminal.buffer.stringIndexToBufferIndex(0, 18),
        terminal.buffer.stringIndexToBufferIndex(0, 19));
      // after the combining char every string index has an offset of -1
      for (let i = 19; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i - 1) / terminal.cols) | 0, (i - 1) % terminal.cols], bufferIndex);
      }
    });

    it('multiline combining e\u0301', async () => {
      const input = 'e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // every buffer cell index contains 2 string indices
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i >> 1) / terminal.cols) | 0, (i >> 1) % terminal.cols], bufferIndex);
      }
    });

    it('surrogate char in a sentence', async () => {
      const input = 'The 𝄞 is a clef widely used in modern notation.';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < 5; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(i / terminal.cols) | 0, i % terminal.cols], bufferIndex);
      }
      // string index 4 & 5 point to surrogate char 𝄞 ---> same buffer Index
      assert.deepEqual(
        terminal.buffer.stringIndexToBufferIndex(0, 4),
        terminal.buffer.stringIndexToBufferIndex(0, 5));
      // after the combining char every string index has an offset of -1
      for (let i = 5; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i - 1) / terminal.cols) | 0, (i - 1) % terminal.cols], bufferIndex);
      }
    });

    it('multiline surrogate char', async () => {
      const input = '𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // every buffer cell index contains 2 string indices
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i >> 1) / terminal.cols) | 0, (i >> 1) % terminal.cols], bufferIndex);
      }
    });

    it('surrogate char with combining', async () => {
      // eye of Ra with acute accent - string length of 3
      const input = '𓂀\u0301 - the eye hiroglyph with an acute accent.';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // index 0..2 should map to 0
      assert.deepEqual([0, 0], terminal.buffer.stringIndexToBufferIndex(0, 1));
      assert.deepEqual([0, 0], terminal.buffer.stringIndexToBufferIndex(0, 2));
      for (let i = 2; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i - 2) / terminal.cols) | 0, (i - 2) % terminal.cols], bufferIndex);
      }
    });

    it('multiline surrogate with combining', async () => {
      const input = '𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // every buffer cell index contains 3 string indices
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(((i / 3) | 0) / terminal.cols) | 0, ((i / 3) | 0) % terminal.cols], bufferIndex);
      }
    });

    it('fullwidth chars', async () => {
      const input = 'These １２３ are some fat numbers.';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < 6; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(i / terminal.cols) | 0, i % terminal.cols], bufferIndex);
      }
      // string index 6, 7, 8 take 2 cells
      assert.deepEqual([0, 8], terminal.buffer.stringIndexToBufferIndex(0, 7));
      assert.deepEqual([1, 0], terminal.buffer.stringIndexToBufferIndex(0, 8));
      // rest of the string has offset of +3
      for (let i = 9; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i + 3) / terminal.cols) | 0, (i + 3) % terminal.cols], bufferIndex);
      }
    });

    it('multiline fullwidth chars', async () => {
      const input = '１２３４５６７８９０１２３４５６７８９０';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 9; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i << 1) / terminal.cols) | 0, (i << 1) % terminal.cols], bufferIndex);
      }
    });

    it('fullwidth combining with emoji - match emoji cell', async () => {
      const input = 'Lots of ￥\u0301 make me 😃.';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      const stringIndex = s.match(/😃/)!.index!;
      const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, stringIndex);
      assert(terminal.buffer.lines.get(bufferIndex[0])!.loadCell(bufferIndex[1], new CellData()).getChars(), '😃');
    });

    it('multiline fullwidth chars with offset 1 (currently tests for broken behavior)', async () => {
      const input = 'a１２３４５６７８９０１２３４５６７８９０';
      // the 'a' at the beginning moves all fullwidth chars one to the right
      // now the end of the line contains a dangling empty cell since
      // the next fullwidth char has to wrap early
      // the dangling last cell is wrongly added in the string
      // --> fixable after resolving #1685
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 10; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i, true);
        const j = (i - 0) << 1;
        assert.deepEqual([(j / terminal.cols) | 0, j % terminal.cols], bufferIndex);
      }
    });

    it('test fully wrapped buffer up to last char', async () => {
      const input = Array(6).join('1234567890');
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i, true);
        assert.equal(input[i], terminal.buffer.lines.get(bufferIndex[0])!.loadCell(bufferIndex[1], new CellData()).getChars());
      }
    });

    it('test fully wrapped buffer up to last char with full width odd', async () => {
      const input = 'a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301'
        + 'a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i, true);
        assert.equal(
          (!(i % 3))
            ? input[i]
            : (i % 3 === 1)
              ? input.substr(i, 2)
              : input.substr(i - 1, 2),
          terminal.buffer.lines.get(bufferIndex[0])!.loadCell(bufferIndex[1], new CellData()).getChars());
      }
    });

    it('should handle \t in lines correctly', async () => {
      const input = '\thttps://google.de';
      await terminal.writeP(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(s, Array(terminal.optionsService.options.tabStopWidth + 1).join(' ') + 'https://google.de');
    });
  });

  describe('BufferStringIterator', function (): void {
    it('iterator does not overflow buffer limits', async () => {
      const terminal = new TestTerminal({ rows: 5, cols: 10, scrollback: 5 });
      const data = [
        'aaaaaaaaaa',
        'aaaaaaaaa\n',
        'aaaaaaaaaa',
        'aaaaaaaaa\n',
        'aaaaaaaaaa',
        'aaaaaaaaaa',
        'aaaaaaaaaa',
        'aaaaaaaaa\n',
        'aaaaaaaaaa',
        'aaaaaaaaaa'
      ];
      await terminal.writeP(data.join(''));
      // brute force test with insane values
      assert.doesNotThrow(() => {
        for (let overscan = 0; overscan < 20; ++overscan) {
          for (let start = -10; start < 20; ++start) {
            for (let end = -10; end < 20; ++end) {
              const it = terminal.buffer.iterator(false, start, end, overscan, overscan);
              while (it.hasNext()) {
                it.next();
              }
            }
          }
        }
      });
    });
  });

  describe('Windows Mode', () => {
    it('should mark lines as wrapped when the line ends in a non-null character after a LF', async () => {
      const data = [
        'aaaaaaaaaa\n\r', // cannot wrap as it's the first
        'aaaaaaaaa\n\r',  // wrapped (windows mode only)
        'aaaaaaaaa'       // not wrapped
      ];

      const normalTerminal = new TestTerminal({ rows: 5, cols: 10, windowsMode: false });
      await normalTerminal.writeP(data.join(''));
      assert.equal(normalTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(1)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(2)!.isWrapped, false);

      const windowsModeTerminal = new TestTerminal({ rows: 5, cols: 10, windowsMode: true });
      await windowsModeTerminal.writeP(data.join(''));
      assert.equal(windowsModeTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(windowsModeTerminal.buffer.lines.get(1)!.isWrapped, true, 'This line should wrap in Windows mode as the previous line ends in a non-null character');
      assert.equal(windowsModeTerminal.buffer.lines.get(2)!.isWrapped, false);
    });

    it('should mark lines as wrapped when the line ends in a non-null character after a CUP', async () => {
      const data = [
        'aaaaaaaaaa\x1b[2;1H', // cannot wrap as it's the first
        'aaaaaaaaa\x1b[3;1H',  // wrapped (windows mode only)
        'aaaaaaaaa'             // not wrapped
      ];

      const normalTerminal = new TestTerminal({ rows: 5, cols: 10, windowsMode: false });
      await normalTerminal.writeP(data.join(''));
      assert.equal(normalTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(1)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(2)!.isWrapped, false);

      const windowsModeTerminal = new TestTerminal({ rows: 5, cols: 10, windowsMode: true });
      await windowsModeTerminal.writeP(data.join(''));
      assert.equal(windowsModeTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(windowsModeTerminal.buffer.lines.get(1)!.isWrapped, true, 'This line should wrap in Windows mode as the previous line ends in a non-null character');
      assert.equal(windowsModeTerminal.buffer.lines.get(2)!.isWrapped, false);
    });
  });
  it('convertEol setting', async () => {
    // not converting
    const termNotConverting = new TestTerminal({ cols: 15, rows: 10 });
    await termNotConverting.writeP('Hello\nWorld');
    assert.equal(termNotConverting.buffer.lines.get(0)!.translateToString(false), 'Hello          ');
    assert.equal(termNotConverting.buffer.lines.get(1)!.translateToString(false), '     World     ');
    assert.equal(termNotConverting.buffer.lines.get(0)!.translateToString(true), 'Hello');
    assert.equal(termNotConverting.buffer.lines.get(1)!.translateToString(true), '     World');

    // converting
    const termConverting = new TestTerminal({ cols: 15, rows: 10, convertEol: true });
    await termConverting.writeP('Hello\nWorld');
    assert.equal(termConverting.buffer.lines.get(0)!.translateToString(false), 'Hello          ');
    assert.equal(termConverting.buffer.lines.get(1)!.translateToString(false), 'World          ');
    assert.equal(termConverting.buffer.lines.get(0)!.translateToString(true), 'Hello');
    assert.equal(termConverting.buffer.lines.get(1)!.translateToString(true), 'World');
  });

  // FIXME: move to common/CoreTerminal.test once the trimming is moved over
  describe('marker lifecycle', () => {
    // create a 10x5 terminal with markers on every line
    // to test marker lifecycle under various terminal actions
    let markers: IMarker[];
    let disposeStack: IMarker[];
    let term: TestTerminal;
    beforeEach(async () => {
      term = new TestTerminal({});
      markers = [];
      disposeStack = [];
      term.optionsService.setOption('scrollback', 1);
      term.resize(10, 5);
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      await term.writeP('\x1b[r0\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      await term.writeP('1\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      await term.writeP('2\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      await term.writeP('3\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      await term.writeP('4');
      for (let i = 0; i < markers.length; ++i) {
        const marker = markers[i];
        marker.onDispose(() => disposeStack.push(marker));
      }
    });
    it('initial', () => {
      assert.deepEqual(markers.map(m => m.line), [0, 1, 2, 3, 4]);
    });
    it('should dispose on normal trim off the top', async () => {
      // moves top line into scrollback
      await term.writeP('\n');
      assert.deepEqual(disposeStack, []);
      // trims first marker
      await term.writeP('\n');
      assert.deepEqual(disposeStack, [markers[0]]);
      // trims second marker
      await term.writeP('\n');
      assert.deepEqual(disposeStack, [markers[0], markers[1]]);
      // trimmed marker objs should be disposed
      assert.deepEqual(disposeStack.map(el => el.isDisposed), [true, true]);
      assert.deepEqual(disposeStack.map(el => (el as any)._isDisposed), [true, true]);
      // trimmed markers should contain line -1
      assert.deepEqual(disposeStack.map(el => el.line), [-1, -1]);
    });
    it('should dispose on DL', async () => {
      await term.writeP('\x1b[3;1H');  // move cursor to 0, 2
      await term.writeP('\x1b[2M');    // delete 2 lines
      assert.deepEqual(disposeStack, [markers[2], markers[3]]);
    });
    it('should dispose on IL', async () => {
      await term.writeP('\x1b[3;1H');  // move cursor to 0, 2
      await term.writeP('\x1b[2L');    // insert 2 lines
      assert.deepEqual(disposeStack, [markers[4], markers[3]]);
      assert.deepEqual(markers.map(el => el.line), [0, 1, 4, -1, -1]);
    });
    it('should dispose on resize', () => {
      term.resize(10, 2);
      assert.deepEqual(disposeStack, [markers[0], markers[1]]);
      assert.deepEqual(markers.map(el => el.line), [-1, -1, 0, 1, 2]);
    });
  });
});

class TestLinkifier extends Linkifier {
  constructor(bufferService: IBufferService, unicodeService: IUnicodeService) {
    super(bufferService, new MockLogService(), unicodeService);
    Linkifier._timeBeforeLatency = 0;
  }

  public get linkMatchers(): IRegisteredLinkMatcher[] { return this._linkMatchers; }
  public linkifyRows(): void { super.linkifyRows(0, this._bufferService.buffer.lines.length - 1); }
}

class TestMouseZoneManager implements IMouseZoneManager {
  public dispose(): void {
  }
  public clears: number = 0;
  public zones: IMouseZone[] = [];
  public add(zone: IMouseZone): void {
    this.zones.push(zone);
  }
  public clearAll(): void {
    this.clears++;
  }
}
