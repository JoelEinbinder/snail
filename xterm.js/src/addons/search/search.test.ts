/**
 * Copyright (c) 2018 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert, expect } from 'chai';
import * as search from './search';
import { SearchHelper } from './SearchHelper';
import { ISearchOptions, ISearchResult } from './Interfaces';


class MockTerminalPlain {}

class MockTerminal {
  private _core: any;
<<<<<<< HEAD
  public searchHelper: TestSearchHelper;
  constructor(options: any) {
    this._core = new (require('../../../lib/Terminal').Terminal)(options);
    this.searchHelper = new TestSearchHelper(this as any);
=======
  public searchHelper: ISearchHelper;
  public cols: number;
  constructor(options: any) {
    this._core = new (require('../../../lib/Terminal').Terminal)(options);
    this.searchHelper = new SearchHelper(this as any);
    this.cols = options.cols;
>>>>>>> Fixed issues around searching lines twice and considering a wrapped line both it's own line and part of the previous line.
  }
  get core(): any {
    return this._core;
  }
  pushWriteData(): void {
    this._core._innerWrite();
  }
}

class TestSearchHelper extends SearchHelper {
  public findInLine(term: string, y: number, searchOptions?: ISearchOptions): ISearchResult {
    return this._findInLine(term, y, searchOptions);
  }
}

describe('search addon', function(): void {
  describe('apply', () => {
    it('should register findNext and findPrevious', () => {
      search.apply(<any>MockTerminalPlain);
      assert.equal(typeof (<any>MockTerminalPlain).prototype.findNext, 'function');
      assert.equal(typeof (<any>MockTerminalPlain).prototype.findPrevious, 'function');
    });
  });
  describe('find', () => {
    it('Searchhelper - should find correct position', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 20, rows: 3});
      term.core.write('Hello World\r\ntest\n123....hello');
      term.pushWriteData();
      const hello0 = term.searchHelper.findInLine('Hello', 0);
      const hello1 = term.searchHelper.findInLine('Hello', 1);
      const hello2 = term.searchHelper.findInLine('Hello', 2);
      expect(hello0).eql({col: 0, row: 0, term: 'Hello'});
      expect(hello1).eql(undefined);
      expect(hello2).eql({col: 11, row: 2, term: 'Hello'});
    });
    it('should find search term accross line wrap', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 10, rows: 5});
      term.core.write('texttextHellotext\r\n');
      term.core.write('texttexttextHellotext');
      term.pushWriteData();
      /*
        texttextHe
        llotext
        texttextte
        xtHellotex
        t
      */

      const hello0 = (term.searchHelper as any)._findInLine('Hello', 0);
      const hello1 = (term.searchHelper as any)._findInLine('Hello', 1);
      const hello2 = (term.searchHelper as any)._findInLine('Hello', 2);
      const hello3 = (term.searchHelper as any)._findInLine('Hello', 3);
      const llo = (term.searchHelper as any)._findInLine('llo', 1);
      expect(hello0).eql({col: 8, row: 0, term: 'Hello'});
      expect(hello1).eql(undefined);
      expect(hello2).eql({col: 2, row: 3, term: 'Hello'});
      expect(hello3).eql(undefined);
      expect(llo).eql(undefined);
    });
    it('should respect search regex', function(): void {
      search.apply(<any>MockTerminal);
      const term = new MockTerminal({cols: 10, rows: 4});
      term.core.write('abcdefghijklmnopqrstuvwxyz\r\n~/dev  ');
      /*
        abcdefghij
        klmnopqrst
        uvwxyz
        ~/dev
      */
      term.pushWriteData();
      const searchOptions = {
        regex: true,
        wholeWord: false,
        caseSensitive: false
      };
      const hello0 = term.searchHelper.findInLine('dee*', 0, searchOptions);
      const hello1 = term.searchHelper.findInLine('jkk*', 0, searchOptions);
      const hello2 = term.searchHelper.findInLine('mnn*', 1, searchOptions);
      const tilda0 = term.searchHelper.findInLine('^~', 3, searchOptions);
      const tilda1 = term.searchHelper.findInLine('^[~]', 3, searchOptions);
      const tilda2 = term.searchHelper.findInLine('^\\~', 3, searchOptions);
      expect(hello0).eql({col: 3, row: 0, term: 'de'});
      expect(hello1).eql({col: 9, row: 0, term: 'jk'});
      expect(hello2).eql(undefined);
      expect(tilda0).eql({col: 0, row: 3, term: '~'});
      expect(tilda1).eql({col: 0, row: 3, term: '~'});
      expect(tilda2).eql({col: 0, row: 3, term: '~'});
    });
  });
});
