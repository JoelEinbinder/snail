/**
 * Copyright (c) 2016 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';
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
    (<any>term).renderer = new MockRenderer();
    term.viewport = new MockViewport();
    (<any>term)._compositionHelper = new MockCompositionHelper();
    (<any>term).element = {
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
    it('should fire the onCursorMove event', (done) => {
      term.onCursorMove(() => done());
      term.writeSync('foo');
    });
    it('should fire the onLineFeed event', (done) => {
      term.onLineFeed(() => done());
      term.writeSync('\n');
    });
    it('should fire a scroll event when scrollback is created', (done) => {
      term.onScroll(() => done());
      term.writeSync('\n'.repeat(INIT_ROWS));
    });
    it('should fire a scroll event when scrollback is cleared', (done) => {
      term.writeSync('\n'.repeat(INIT_ROWS));
      term.onScroll(() => done());
      term.clear();
    });
    it('should fire a key event after a keypress DOM event', (done) => {
      term.onKey(e => {
        assert.equal(typeof e.key, 'string');
        expect(e.domEvent).to.be.an.instanceof(Object);
        done();
      });
      const evKeyPress = <KeyboardEvent>{
        preventDefault: () => { },
        stopPropagation: () => { },
        type: 'keypress',
        keyCode: 13
      };
      term.keyPress(evKeyPress);
    });
    it('should fire a key event after a keydown DOM event', (done) => {
      term.onKey(e => {
        assert.equal(typeof e.key, 'string');
        expect(e.domEvent).to.be.an.instanceof(Object);
        done();
      });
      (<any>term).textarea = { value: '' };
      const evKeyDown = <KeyboardEvent>{
        preventDefault: () => { },
        stopPropagation: () => { },
        type: 'keydown',
        keyCode: 13
      };
      term.keyDown(evKeyDown);
    });
    it('should fire the onResize event', (done) => {
      term.onResize(e => {
        expect(e).to.have.keys(['cols', 'rows']);
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
  });

  describe('attachCustomKeyEventHandler', () => {
    const evKeyDown = <KeyboardEvent>{
      preventDefault: () => { },
      stopPropagation: () => { },
      type: 'keydown',
      keyCode: 77
    };
    const evKeyPress = <KeyboardEvent>{
      preventDefault: () => { },
      stopPropagation: () => { },
      type: 'keypress',
      keyCode: 77
    };

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
    it('should clear a buffer larger than rows', () => {
      // Fill the buffer with dummy rows
      for (let i = 0; i < term.rows * 2; i++) {
        term.writeSync('test\n');
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
    it('should respect bracketed paste mode', done => {
      term.onData(e => {
        assert.equal(e, '\x1b[200~foo\x1b[201~');
        done();
      });
      term.writeSync('\x1b[?2004h');
      term.paste('foo');
    });
  });

  describe('scroll', () => {
    describe('scrollLines', () => {
      let startYDisp: number;
      beforeEach(() => {
        for (let i = 0; i < INIT_ROWS * 2; i++) {
          term.writeSync('test\r\n');
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
      beforeEach(() => {
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeSync('test\r\n');
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
      beforeEach(() => {
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeSync('test\r\n');
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
      beforeEach(() => {
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeSync('test\r\n');
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
      beforeEach(() => {
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeSync('test\r\n');
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
        const event = <KeyboardEvent>{
          type: 'keydown',
          key: 'a',
          keyCode: 65,
          preventDefault: () => { },
          stopPropagation: () => { }
        };

        term.buffer.ydisp = 0;
        term.buffer.ybase = 40;
        term.keyPress(event);

        // Ensure that now the terminal is scrolled to bottom
        assert.equal(term.buffer.ydisp, term.buffer.ybase);
      });

      it('should not scroll down, when a custom keydown handler prevents the event', () => {
        // Add some output to the terminal
        for (let i = 0; i < term.rows * 3; i++) {
          term.writeSync('test\r\n');
        }
        const startYDisp = (term.rows * 2) + 1;
        term.attachCustomKeyEventHandler(() => {
          return false;
        });

        assert.equal(term.buffer.ydisp, startYDisp);
        term.scrollLines(-1);
        assert.equal(term.buffer.ydisp, startYDisp - 1);
        term.keyPress(<KeyboardEvent>{ keyCode: 0 });
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
    it('2 characters per cell', function (): void {
      this.timeout(10000);  // This is needed because istanbul patches code and slows it down
      const high = String.fromCharCode(0xD800);
      const cell = new CellData();
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.writeSync(high + String.fromCharCode(i));
        const tchar = term.buffer.lines.get(0)!.loadCell(0, cell);
        expect(tchar.getChars()).eql(high + String.fromCharCode(i));
        expect(tchar.getChars().length).eql(2);
        expect(tchar.getWidth()).eql(1);
        expect(term.buffer.lines.get(0)!.loadCell(1, cell).getChars()).eql('');
        term.reset();
      }
    });
    it('2 characters at last cell', () => {
      const high = String.fromCharCode(0xD800);
      const cell = new CellData();
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;
        term.writeSync(high + String.fromCharCode(i));
        expect(term.buffer.lines.get(0)!.loadCell(term.buffer.x - 1, cell).getChars()).eql(high + String.fromCharCode(i));
        expect(term.buffer.lines.get(0)!.loadCell(term.buffer.x - 1, cell).getChars().length).eql(2);
        expect(term.buffer.lines.get(1)!.loadCell(0, cell).getChars()).eql('');
        term.reset();
      }
    });
    it('2 characters per cell over line end with autowrap', () => {
      const high = String.fromCharCode(0xD800);
      const cell = new CellData();
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;

        term.writeSync('a' + high + String.fromCharCode(i));
        expect(term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell).getChars()).eql('a');
        expect(term.buffer.lines.get(1)!.loadCell(0, cell).getChars()).eql(high + String.fromCharCode(i));
        expect(term.buffer.lines.get(1)!.loadCell(0, cell).getChars().length).eql(2);
        expect(term.buffer.lines.get(1)!.loadCell(1, cell).getChars()).eql('');
        term.reset();
      }
    });
    it('2 characters per cell over line end without autowrap', () => {
      const high = String.fromCharCode(0xD800);
      const cell = new CellData();
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.buffer.x = term.cols - 1;
        term.writeSync('\x1b[?7l'); // Disable wraparound mode
        const width = wcwidth((0xD800 - 0xD800) * 0x400 + i - 0xDC00 + 0x10000);
        if (width !== 1) {
          continue;
        }
        term.writeSync('a' + high + String.fromCharCode(i));
        // auto wraparound mode should cut off the rest of the line
        expect(term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell).getChars()).eql(high + String.fromCharCode(i));
        expect(term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell).getChars().length).eql(2);
        expect(term.buffer.lines.get(1)!.loadCell(1, cell).getChars()).eql('');
        term.reset();
      }
    });
    it('splitted surrogates', () => {
      const high = String.fromCharCode(0xD800);
      const cell = new CellData();
      for (let i = 0xDC00; i <= 0xDCFF; ++i) {
        term.writeSync(high);
        term.writeSync(String.fromCharCode(i));
        const tchar = term.buffer.lines.get(0)!.loadCell(0, cell);
        expect(tchar.getChars()).eql(high + String.fromCharCode(i));
        expect(tchar.getChars().length).eql(2);
        expect(tchar.getWidth()).eql(1);
        expect(term.buffer.lines.get(0)!.loadCell(1, cell).getChars()).eql('');
        term.reset();
      }
    });
  });

  describe('unicode - combining characters', () => {
    const cell = new CellData();
    it('café', () => {
      term.writeSync('cafe\u0301');
      term.buffer.lines.get(0)!.loadCell(3, cell);
      expect(cell.getChars()).eql('e\u0301');
      expect(cell.getChars().length).eql(2);
      expect(cell.getWidth()).eql(1);
    });
    it('café - end of line', () => {
      term.buffer.x = term.cols - 1 - 3;
      term.writeSync('cafe\u0301');
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      expect(cell.getChars()).eql('e\u0301');
      expect(cell.getChars().length).eql(2);
      expect(cell.getWidth()).eql(1);
      term.buffer.lines.get(0)!.loadCell(1, cell);
      expect(cell.getChars()).eql('');
      expect(cell.getChars().length).eql(0);
      expect(cell.getWidth()).eql(1);
    });
    it('multiple combined é', () => {
      term.writeSync(Array(100).join('e\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        expect(cell.getChars()).eql('e\u0301');
        expect(cell.getChars().length).eql(2);
        expect(cell.getWidth()).eql(1);
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      expect(cell.getChars()).eql('e\u0301');
      expect(cell.getChars().length).eql(2);
      expect(cell.getWidth()).eql(1);
    });
    it('multiple surrogate with combined', () => {
      term.writeSync(Array(100).join('\uD800\uDC00\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        expect(cell.getChars()).eql('\uD800\uDC00\u0301');
        expect(cell.getChars().length).eql(3);
        expect(cell.getWidth()).eql(1);
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      expect(cell.getChars()).eql('\uD800\uDC00\u0301');
      expect(cell.getChars().length).eql(3);
      expect(cell.getWidth()).eql(1);
    });
  });

  describe('unicode - fullwidth characters', () => {
    const cell = new CellData();
    it('cursor movement even', () => {
      expect(term.buffer.x).eql(0);
      term.writeSync('￥');
      expect(term.buffer.x).eql(2);
    });
    it('cursor movement odd', () => {
      term.buffer.x = 1;
      expect(term.buffer.x).eql(1);
      term.writeSync('￥');
      expect(term.buffer.x).eql(3);
    });
    it('line of ￥ even', () => {
      term.writeSync(Array(50).join('￥'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (i % 2) {
          expect(cell.getChars()).eql('');
          expect(cell.getChars().length).eql(0);
          expect(cell.getWidth()).eql(0);
        } else {
          expect(cell.getChars()).eql('￥');
          expect(cell.getChars().length).eql(1);
          expect(cell.getWidth()).eql(2);
        }
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      expect(cell.getChars()).eql('￥');
      expect(cell.getChars().length).eql(1);
      expect(cell.getWidth()).eql(2);
    });
    it('line of ￥ odd', () => {
      term.buffer.x = 1;
      term.writeSync(Array(50).join('￥'));
      for (let i = 1; i < term.cols - 1; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (!(i % 2)) {
          expect(cell.getChars()).eql('');
          expect(cell.getChars().length).eql(0);
          expect(cell.getWidth()).eql(0);
        } else {
          expect(cell.getChars()).eql('￥');
          expect(cell.getChars().length).eql(1);
          expect(cell.getWidth()).eql(2);
        }
      }
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      expect(cell.getChars()).eql('');
      expect(cell.getChars().length).eql(0);
      expect(cell.getWidth()).eql(1);
      term.buffer.lines.get(1)!.loadCell(0, cell);
      expect(cell.getChars()).eql('￥');
      expect(cell.getChars().length).eql(1);
      expect(cell.getWidth()).eql(2);
    });
    it('line of ￥ with combining odd', () => {
      term.buffer.x = 1;
      term.writeSync(Array(50).join('￥\u0301'));
      for (let i = 1; i < term.cols - 1; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (!(i % 2)) {
          expect(cell.getChars()).eql('');
          expect(cell.getChars().length).eql(0);
          expect(cell.getWidth()).eql(0);
        } else {
          expect(cell.getChars()).eql('￥\u0301');
          expect(cell.getChars().length).eql(2);
          expect(cell.getWidth()).eql(2);
        }
      }
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      expect(cell.getChars()).eql('');
      expect(cell.getChars().length).eql(0);
      expect(cell.getWidth()).eql(1);
      term.buffer.lines.get(1)!.loadCell(0, cell);
      expect(cell.getChars()).eql('￥\u0301');
      expect(cell.getChars().length).eql(2);
      expect(cell.getWidth()).eql(2);
    });
    it('line of ￥ with combining even', () => {
      term.writeSync(Array(50).join('￥\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (i % 2) {
          expect(cell.getChars()).eql('');
          expect(cell.getChars().length).eql(0);
          expect(cell.getWidth()).eql(0);
        } else {
          expect(cell.getChars()).eql('￥\u0301');
          expect(cell.getChars().length).eql(2);
          expect(cell.getWidth()).eql(2);
        }
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      expect(cell.getChars()).eql('￥\u0301');
      expect(cell.getChars().length).eql(2);
      expect(cell.getWidth()).eql(2);
    });
    it('line of surrogate fullwidth with combining odd', () => {
      term.buffer.x = 1;
      term.writeSync(Array(50).join('\ud843\ude6d\u0301'));
      for (let i = 1; i < term.cols - 1; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (!(i % 2)) {
          expect(cell.getChars()).eql('');
          expect(cell.getChars().length).eql(0);
          expect(cell.getWidth()).eql(0);
        } else {
          expect(cell.getChars()).eql('\ud843\ude6d\u0301');
          expect(cell.getChars().length).eql(3);
          expect(cell.getWidth()).eql(2);
        }
      }
      term.buffer.lines.get(0)!.loadCell(term.cols - 1, cell);
      expect(cell.getChars()).eql('');
      expect(cell.getChars().length).eql(0);
      expect(cell.getWidth()).eql(1);
      term.buffer.lines.get(1)!.loadCell(0, cell);
      expect(cell.getChars()).eql('\ud843\ude6d\u0301');
      expect(cell.getChars().length).eql(3);
      expect(cell.getWidth()).eql(2);
    });
    it('line of surrogate fullwidth with combining even', () => {
      term.writeSync(Array(50).join('\ud843\ude6d\u0301'));
      for (let i = 0; i < term.cols; ++i) {
        term.buffer.lines.get(0)!.loadCell(i, cell);
        if (i % 2) {
          expect(cell.getChars()).eql('');
          expect(cell.getChars().length).eql(0);
          expect(cell.getWidth()).eql(0);
        } else {
          expect(cell.getChars()).eql('\ud843\ude6d\u0301');
          expect(cell.getChars().length).eql(3);
          expect(cell.getWidth()).eql(2);
        }
      }
      term.buffer.lines.get(1)!.loadCell(0, cell);
      expect(cell.getChars()).eql('\ud843\ude6d\u0301');
      expect(cell.getChars().length).eql(3);
      expect(cell.getWidth()).eql(2);
    });
  });

  describe('insert mode', () => {
    const cell = new CellData();
    it('halfwidth - all', () => {
      term.writeSync(Array(9).join('0123456789').slice(-80));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.write('\x1b[4h');
      term.writeSync('abcde');
      expect(term.buffer.lines.get(0)!.length).eql(term.cols);
      expect(term.buffer.lines.get(0)!.loadCell(10, cell).getChars()).eql('a');
      expect(term.buffer.lines.get(0)!.loadCell(14, cell).getChars()).eql('e');
      expect(term.buffer.lines.get(0)!.loadCell(15, cell).getChars()).eql('0');
      expect(term.buffer.lines.get(0)!.loadCell(79, cell).getChars()).eql('4');
    });
    it('fullwidth - insert', () => {
      term.writeSync(Array(9).join('0123456789').slice(-80));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.write('\x1b[4h');
      term.writeSync('￥￥￥');
      expect(term.buffer.lines.get(0)!.length).eql(term.cols);
      expect(term.buffer.lines.get(0)!.loadCell(10, cell).getChars()).eql('￥');
      expect(term.buffer.lines.get(0)!.loadCell(11, cell).getChars()).eql('');
      expect(term.buffer.lines.get(0)!.loadCell(14, cell).getChars()).eql('￥');
      expect(term.buffer.lines.get(0)!.loadCell(15, cell).getChars()).eql('');
      expect(term.buffer.lines.get(0)!.loadCell(79, cell).getChars()).eql('3');
    });
    it('fullwidth - right border', () => {
      term.writeSync(Array(41).join('￥'));
      term.buffer.x = 10;
      term.buffer.y = 0;
      term.write('\x1b[4h');
      term.writeSync('a');
      expect(term.buffer.lines.get(0)!.length).eql(term.cols);
      expect(term.buffer.lines.get(0)!.loadCell(10, cell).getChars()).eql('a');
      expect(term.buffer.lines.get(0)!.loadCell(11, cell).getChars()).eql('￥');
      expect(term.buffer.lines.get(0)!.loadCell(79, cell).getChars()).eql('');  // fullwidth char got replaced
      term.writeSync('b');
      expect(term.buffer.lines.get(0)!.length).eql(term.cols);
      expect(term.buffer.lines.get(0)!.loadCell(11, cell).getChars()).eql('b');
      expect(term.buffer.lines.get(0)!.loadCell(12, cell).getChars()).eql('￥');
      expect(term.buffer.lines.get(0)!.loadCell(79, cell).getChars()).eql('');  // empty cell after fullwidth
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

    function assertLinkifiesInTerminal(rowText: string, linkMatcherRegex: RegExp, links: {x1: number, y1: number, x2: number, y2: number}[], done: Mocha.Done): void {
      terminal.writeSync(rowText);
      linkifier.registerLinkMatcher(linkMatcherRegex, () => {});
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
        done();
      }, 0);
    }

    describe('unicode before the match', () => {
      it('combining - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal('e\u0301e\u0301e\u0301 foo', /foo/, [{x1: 4, x2: 7, y1: 0, y2: 0}], done);
      });
      it('combining - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal('e\u0301e\u0301e\u0301     foo', /foo/, [{x1: 8, x2: 1, y1: 0, y2: 1}], done);
      });
      it('surrogate - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal('𝄞𝄞𝄞 foo', /foo/, [{x1: 4, x2: 7, y1: 0, y2: 0}], done);
      });
      it('surrogate - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal('𝄞𝄞𝄞     foo', /foo/, [{x1: 8, x2: 1, y1: 0, y2: 1}], done);
      });
      it('combining surrogate - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal('𓂀\u0301𓂀\u0301𓂀\u0301 foo', /foo/, [{x1: 4, x2: 7, y1: 0, y2: 0}], done);
      });
      it('combining surrogate - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal('𓂀\u0301𓂀\u0301𓂀\u0301     foo', /foo/, [{x1: 8, x2: 1, y1: 0, y2: 1}], done);
      });
      it('fullwidth - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal('１２ foo', /foo/, [{x1: 5, x2: 8, y1: 0, y2: 0}], done);
      });
      it('fullwidth - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal('１２    foo', /foo/, [{x1: 8, x2: 1, y1: 0, y2: 1}], done);
      });
      it('combining fullwidth - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal('￥\u0301￥\u0301 foo', /foo/, [{x1: 5, x2: 8, y1: 0, y2: 0}], done);
      });
      it('combining fullwidth - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal('￥\u0301￥\u0301    foo', /foo/, [{x1: 8, x2: 1, y1: 0, y2: 1}], done);
      });
    });
    describe('unicode within the match', () => {
      it('combining - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal('test cafe\u0301', /cafe\u0301/, [{x1: 5, x2: 9, y1: 0, y2: 0}], done);
      });
      it('combining - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal('testtest cafe\u0301', /cafe\u0301/, [{x1: 9, x2: 3, y1: 0, y2: 1}], done);
      });
      it('surrogate - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal('test a𝄞b', /a𝄞b/, [{x1: 5, x2: 8, y1: 0, y2: 0}], done);
      });
      it('surrogate - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal('testtest a𝄞b', /a𝄞b/, [{x1: 9, x2: 2, y1: 0, y2: 1}], done);
      });
      it('combining surrogate - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal('test a𓂀\u0301b', /a𓂀\u0301b/, [{x1: 5, x2: 8, y1: 0, y2: 0}], done);
      });
      it('combining surrogate - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal('testtest a𓂀\u0301b', /a𓂀\u0301b/, [{x1: 9, x2: 2, y1: 0, y2: 1}], done);
      });
      it('fullwidth - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal('test a１b', /a１b/, [{x1: 5, x2: 9, y1: 0, y2: 0}], done);
      });
      it('fullwidth - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal('testtest a１b', /a１b/, [{x1: 9, x2: 3, y1: 0, y2: 1}], done);
      });
      it('combining fullwidth - match within one line', function(done: () => void): void {
        assertLinkifiesInTerminal('test a￥\u0301b', /a￥\u0301b/, [{x1: 5, x2: 9, y1: 0, y2: 0}], done);
      });
      it('combining fullwidth - match over two lines', function(done: () => void): void {
        assertLinkifiesInTerminal('testtest a￥\u0301b', /a￥\u0301b/, [{x1: 9, x2: 3, y1: 0, y2: 1}], done);
      });
    });
  });

  describe('Buffer.stringIndexToBufferIndex', () => {
    let terminal: TestTerminal;

    beforeEach(() => {
      terminal = new TestTerminal({rows: 5, cols: 10, scrollback: 5});
    });

    it('multiline ascii', () => {
      const input = 'This is ASCII text spanning multiple lines.';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(i / terminal.cols) | 0, i % terminal.cols], bufferIndex);
      }
    });

    it('combining e\u0301 in a sentence', () => {
      const input = 'Sitting in the cafe\u0301 drinking coffee.';
      terminal.writeSync(input);
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

    it('multiline combining e\u0301', () => {
      const input = 'e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301e\u0301';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // every buffer cell index contains 2 string indices
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i >> 1) / terminal.cols) | 0, (i >> 1) % terminal.cols], bufferIndex);
      }
    });

    it('surrogate char in a sentence', () => {
      const input = 'The 𝄞 is a clef widely used in modern notation.';
      terminal.writeSync(input);
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

    it('multiline surrogate char', () => {
      const input = '𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞𝄞';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // every buffer cell index contains 2 string indices
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i >> 1) / terminal.cols) | 0, (i >> 1) % terminal.cols], bufferIndex);
      }
    });

    it('surrogate char with combining', () => {
      // eye of Ra with acute accent - string length of 3
      const input = '𓂀\u0301 - the eye hiroglyph with an acute accent.';
      terminal.writeSync(input);
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

    it('multiline surrogate with combining', () => {
      const input = '𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301𓂀\u0301';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      // every buffer cell index contains 3 string indices
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([(((i / 3) | 0) / terminal.cols) | 0, ((i / 3) | 0) % terminal.cols], bufferIndex);
      }
    });

    it('fullwidth chars', () => {
      const input = 'These １２３ are some fat numbers.';
      terminal.writeSync(input);
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

    it('multiline fullwidth chars', () => {
      const input = '１２３４５６７８９０１２３４５６７８９０';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 9; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i);
        assert.deepEqual([((i << 1) / terminal.cols) | 0, (i << 1) % terminal.cols], bufferIndex);
      }
    });

    it('fullwidth combining with emoji - match emoji cell', () => {
      const input = 'Lots of ￥\u0301 make me 😃.';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      const stringIndex = s.match(/😃/)!.index!;
      const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, stringIndex);
      assert(terminal.buffer.lines.get(bufferIndex[0])!.loadCell(bufferIndex[1], new CellData()).getChars(), '😃');
    });

    it('multiline fullwidth chars with offset 1 (currently tests for broken behavior)', () => {
      const input = 'a１２３４５６７８９０１２３４５６７８９０';
      // the 'a' at the beginning moves all fullwidth chars one to the right
      // now the end of the line contains a dangling empty cell since
      // the next fullwidth char has to wrap early
      // the dangling last cell is wrongly added in the string
      // --> fixable after resolving #1685
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 10; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i, true);
        const j = (i - 0) << 1;
        assert.deepEqual([(j / terminal.cols) | 0, j % terminal.cols], bufferIndex);
      }
    });

    it('test fully wrapped buffer up to last char', () => {
      const input = Array(6).join('1234567890');
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(input, s);
      for (let i = 0; i < input.length; ++i) {
        const bufferIndex = terminal.buffer.stringIndexToBufferIndex(0, i, true);
        assert.equal(input[i], terminal.buffer.lines.get(bufferIndex[0])!.loadCell(bufferIndex[1], new CellData()).getChars());
      }
    });

    it('test fully wrapped buffer up to last char with full width odd', () => {
      const input = 'a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301'
                    + 'a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301a￥\u0301';
      terminal.writeSync(input);
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

    it('should handle \t in lines correctly', () => {
      const input = '\thttps://google.de';
      terminal.writeSync(input);
      const s = terminal.buffer.iterator(true).next().content;
      assert.equal(s, Array(terminal.optionsService.options.tabStopWidth + 1).join(' ') + 'https://google.de');
    });
  });

  describe('BufferStringIterator', function(): void {
    it('iterator does not overflow buffer limits', function(): void {
      const terminal = new TestTerminal({rows: 5, cols: 10, scrollback: 5});
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
      terminal.writeSync(data.join(''));
      // brute force test with insane values
      expect(() => {
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
      }).to.not.throw();
    });
  });

  describe('Windows Mode', () => {
    it('should mark lines as wrapped when the line ends in a non-null character after a LF', () => {
      const data = [
        'aaaaaaaaaa\n\r', // cannot wrap as it's the first
        'aaaaaaaaa\n\r',  // wrapped (windows mode only)
        'aaaaaaaaa'       // not wrapped
      ];

      const normalTerminal = new TestTerminal({rows: 5, cols: 10, windowsMode: false});
      normalTerminal.writeSync(data.join(''));
      assert.equal(normalTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(1)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(2)!.isWrapped, false);

      const windowsModeTerminal = new TestTerminal({rows: 5, cols: 10, windowsMode: true});
      windowsModeTerminal.writeSync(data.join(''));
      assert.equal(windowsModeTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(windowsModeTerminal.buffer.lines.get(1)!.isWrapped, true, 'This line should wrap in Windows mode as the previous line ends in a non-null character');
      assert.equal(windowsModeTerminal.buffer.lines.get(2)!.isWrapped, false);
    });

    it('should mark lines as wrapped when the line ends in a non-null character after a CUP', () => {
      const data = [
        'aaaaaaaaaa\x1b[2;1H', // cannot wrap as it's the first
        'aaaaaaaaa\x1b[3;1H',  // wrapped (windows mode only)
        'aaaaaaaaa'             // not wrapped
      ];

      const normalTerminal = new TestTerminal({rows: 5, cols: 10, windowsMode: false});
      normalTerminal.writeSync(data.join(''));
      assert.equal(normalTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(1)!.isWrapped, false);
      assert.equal(normalTerminal.buffer.lines.get(2)!.isWrapped, false);

      const windowsModeTerminal = new TestTerminal({rows: 5, cols: 10, windowsMode: true});
      windowsModeTerminal.writeSync(data.join(''));
      assert.equal(windowsModeTerminal.buffer.lines.get(0)!.isWrapped, false);
      assert.equal(windowsModeTerminal.buffer.lines.get(1)!.isWrapped, true, 'This line should wrap in Windows mode as the previous line ends in a non-null character');
      assert.equal(windowsModeTerminal.buffer.lines.get(2)!.isWrapped, false);
    });
  });
  it('convertEol setting', function(): void {
    // not converting
    const termNotConverting = new TestTerminal({cols: 15, rows: 10});
    termNotConverting.writeSync('Hello\nWorld');
    expect(termNotConverting.buffer.lines.get(0)!.translateToString(false)).equals('Hello          ');
    expect(termNotConverting.buffer.lines.get(1)!.translateToString(false)).equals('     World     ');
    expect(termNotConverting.buffer.lines.get(0)!.translateToString(true)).equals('Hello');
    expect(termNotConverting.buffer.lines.get(1)!.translateToString(true)).equals('     World');

    // converting
    const termConverting = new TestTerminal({cols: 15, rows: 10, convertEol: true});
    termConverting.writeSync('Hello\nWorld');
    expect(termConverting.buffer.lines.get(0)!.translateToString(false)).equals('Hello          ');
    expect(termConverting.buffer.lines.get(1)!.translateToString(false)).equals('World          ');
    expect(termConverting.buffer.lines.get(0)!.translateToString(true)).equals('Hello');
    expect(termConverting.buffer.lines.get(1)!.translateToString(true)).equals('World');
  });
  describe('Terminal InputHandler integration', () => {
    function getLines(term: TestTerminal, limit: number = term.rows): string[] {
      const res: string[] = [];
      for (let i = 0; i < limit; ++i) {
        res.push(term.buffer.lines.get(i)!.translateToString(true));
      }
      return res;
    }

    // This suite cannot live in InputHandler unless Terminal.scroll moved into IBufferService
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

    describe('BS with reverseWraparound set/unset', () => {
      const ttyBS = '\x08 \x08';  // tty ICANON sends <BS SP BS> on pressing BS

      beforeEach(() => {
        term = new TestTerminal({cols: 5, rows: 5, scrollback: 1});
      });

      describe('reverseWraparound set', () => {
        it('should not reverse outside of scroll margins', () => {
          // prepare buffer content
          term.writeSync('#####abcdefghijklmnopqrstuvwxy');
          assert.deepEqual(getLines(term, 6), ['#####', 'abcde', 'fghij', 'klmno', 'pqrst', 'uvwxy']);
          assert.equal(term.buffer.ydisp, 1);
          assert.equal(term.buffer.x, 5);
          assert.equal(term.buffer.y, 4);
          term.writeSync(ttyBS.repeat(100));
          assert.deepEqual(getLines(term, 6), ['#####', 'abcde', 'fghij', 'klmno', 'pqrst', '    y']);

          term.writeSync('\x1b[?45h');
          term.writeSync('uvwxy');

          // set top/bottom to 1/3 (0-based)
          term.writeSync('\x1b[2;4r');
          // place cursor below scroll bottom
          term.buffer.x = 5;
          term.buffer.y = 4;
          term.writeSync(ttyBS.repeat(100));
          assert.deepEqual(getLines(term, 6), ['#####', 'abcde', 'fghij', 'klmno', 'pqrst', '     ']);

          term.writeSync('uvwxy');
          // place cursor within scroll margins
          term.buffer.x = 5;
          term.buffer.y = 3;
          term.writeSync(ttyBS.repeat(100));
          assert.deepEqual(getLines(term, 6), ['#####', 'abcde', '     ', '     ', '     ', 'uvwxy']);
          assert.equal(term.buffer.x, 0);
          assert.equal(term.buffer.y, term.buffer.scrollTop);  // stops at 0, scrollTop

          term.writeSync('fghijklmnopqrst');
          // place cursor above scroll top
          term.buffer.x = 5;
          term.buffer.y = 0;
          term.writeSync(ttyBS.repeat(100));
          assert.deepEqual(getLines(term, 6), ['#####', '     ', 'fghij', 'klmno', 'pqrst', 'uvwxy']);
        });
      });
    });
  });

  // FIXME: move to common/CoreTerminal.test once the trimming is moved over
  describe('marker lifecycle', () => {
    // create a 10x5 terminal with markers on every line
    // to test marker lifecycle under various terminal actions
    let markers: IMarker[];
    let disposeStack: IMarker[];
    let term: TestTerminal;
    beforeEach(() => {
      term = new TestTerminal({});
      markers = [];
      disposeStack = [];
      term.optionsService.setOption('scrollback', 1);
      term.resize(10, 5);
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      term.writeSync('\x1b[r0\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      term.writeSync('1\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      term.writeSync('2\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      term.writeSync('3\r\n');
      markers.push(term.buffers.active.addMarker(term.buffers.active.y));
      term.writeSync('4');
      for (let i = 0; i < markers.length; ++i) {
        const marker = markers[i];
        marker.onDispose(() => disposeStack.push(marker));
      }
    });
    it('initial', () => {
      assert.deepEqual(markers.map(m => m.line), [0, 1, 2, 3, 4]);
    });
    it('should dispose on normal trim off the top', () => {
      // moves top line into scrollback
      term.writeSync('\n');
      assert.deepEqual(disposeStack, []);
      // trims first marker
      term.writeSync('\n');
      assert.deepEqual(disposeStack, [markers[0]]);
      // trims second marker
      term.writeSync('\n');
      assert.deepEqual(disposeStack, [markers[0], markers[1]]);
      // trimmed marker objs should be disposed
      assert.deepEqual(disposeStack.map(el => el.isDisposed), [true, true]);
      assert.deepEqual(disposeStack.map(el => (el as any)._isDisposed), [true, true]);
      // trimmed markers should contain line -1
      assert.deepEqual(disposeStack.map(el => el.line), [-1, -1]);
    });
    it('should dispose on DL', () => {
      term.writeSync('\x1b[3;1H');  // move cursor to 0, 2
      term.writeSync('\x1b[2M');    // delete 2 lines
      assert.deepEqual(disposeStack, [markers[2], markers[3]]);
    });
    it('should dispose on IL', () => {
      term.writeSync('\x1b[3;1H');  // move cursor to 0, 2
      term.writeSync('\x1b[2L');    // insert 2 lines
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
