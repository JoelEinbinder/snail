/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import jsdom = require('jsdom');
import { assert } from 'chai';
import { DomRendererRowFactory } from './DomRendererRowFactory';
import { LineData } from '../../Types';
import { DEFAULT_ATTR } from '../../Buffer';
import { FLAGS } from '../Types';

describe('DomRendererRowFactory', () => {
  let dom: jsdom.JSDOM;
  let rowFactory: DomRendererRowFactory;
  let lineData: LineData;

  beforeEach(() => {
    dom = new jsdom.JSDOM('');
    rowFactory = new DomRendererRowFactory(dom.window.document);
    lineData = createEmptyLineData(4);
  });

  describe('createRow', () => {
    it('should create an element for every character in the row', () => {
      const fragment = rowFactory.createRow(lineData, false, 0, 5);
      assert.equal(getFragmentHtml(fragment),
        '<span> </span>' +
        '<span> </span>' +
        '<span> </span>' +
        '<span> </span>'
      );
    });

    it('should set correct attributes for double width characters', () => {
      lineData[1] = [DEFAULT_ATTR, '語', 2, '語'.charCodeAt(0)];
      // There should be no element for the following "empty" cell
      lineData[2] = [DEFAULT_ATTR, '', 0, undefined];
      const fragment = rowFactory.createRow(lineData, false, 0, 5);
      assert.equal(getFragmentHtml(fragment),
        '<span> </span>' +
        '<span style="width: 10px;">語</span>' +
        '<span> </span>'
      );
    });

    it('should add class for cursor', () => {
      const fragment = rowFactory.createRow(lineData, true, 1, 5);
      assert.equal(getFragmentHtml(fragment),
        '<span> </span>' +
        '<span class="xterm-cursor"> </span>' +
        '<span> </span>' +
        '<span> </span>'
      );
    });

    describe('attributes', () => {
      it('should add class for bold', () => {
        lineData[1] = [DEFAULT_ATTR | (FLAGS.BOLD << 18), 'a', 1, 'a'.charCodeAt(0)];
        const fragment = rowFactory.createRow(lineData, false, 0, 5);
        assert.equal(getFragmentHtml(fragment),
          '<span> </span>' +
          '<span class="xterm-bold">a</span>' +
          '<span> </span>' +
          '<span> </span>'
        );
      });

      it('should add class for italic', () => {
        lineData[1] = [DEFAULT_ATTR | (FLAGS.ITALIC << 18), 'a', 1, 'a'.charCodeAt(0)];
        const fragment = rowFactory.createRow(lineData, false, 0, 5);
        assert.equal(getFragmentHtml(fragment),
          '<span> </span>' +
          '<span class="xterm-italic">a</span>' +
          '<span> </span>' +
          '<span> </span>'
        );
      });
    });
  });

  function getFragmentHtml(fragment: DocumentFragment): string {
    const element = dom.window.document.createElement('div');
    element.appendChild(fragment);
    return element.innerHTML;
  }

  function createEmptyLineData(cols: number): LineData {
    const lineData: LineData = [];
    for (let i = 0; i < cols; i++) {
      lineData.push([DEFAULT_ATTR, ' ', 1, 32 /* ' '.charCodeAt(0) */]);
    }
    return lineData;
  }
});
