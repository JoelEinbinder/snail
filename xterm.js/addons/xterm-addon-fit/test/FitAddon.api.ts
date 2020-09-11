/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { assert } from 'chai';
import { openTerminal, getBrowserType } from '../../../out-test/api/TestUtils';
import { Browser, Page } from 'playwright';

const APP = 'http://127.0.0.1:3000/test';

let browser: Browser;
let page: Page;
const width = 1024;
const height = 768;

describe('FitAddon', () => {
  before(async function(): Promise<any> {
    const browserType = getBrowserType();
    browser = await browserType.launch({
      headless: process.argv.indexOf('--headless') !== -1
    });
    page = await (await browser.newContext()).newPage();
    await page.setViewportSize({ width, height });
    await page.goto(APP);
  });

  beforeEach(async function(): Promise<any> {
    await page.evaluate(`document.querySelector('#terminal-container').style.display=''`);
    await openTerminal(page);
  });

  after(async () => {
    await browser.close();
  });

  afterEach(async function(): Promise<any> {
    await page.evaluate(`window.term.dispose()`);
  });

  it('no terminal', async function(): Promise<any> {
    await page.evaluate(`window.fit = new FitAddon();`);
    assert.equal(await page.evaluate(`window.fit.proposeDimensions()`), undefined);
  });

  describe('proposeDimensions', () => {
    afterEach(async () => {
      return unloadFit();
    });

    it('default', async function(): Promise<any> {
      await loadFit();
      const dimensions: {cols: number, rows: number} = await page.evaluate(`window.fit.proposeDimensions()`);
      assert.equal(dimensions.cols, 87);
      assert.isAbove(dimensions.rows, 24);
      assert.isBelow(dimensions.rows, 29);
    });

    it('width', async function(): Promise<any> {
      await loadFit(1008);
      const dimensions: {cols: number, rows: number} = await page.evaluate(`window.fit.proposeDimensions()`);
      assert.equal(dimensions.cols, 110);
      assert.isAbove(dimensions.rows, 24);
      assert.isBelow(dimensions.rows, 29);
    });

    it('small', async function(): Promise<any> {
      await loadFit(1, 1);
      assert.deepEqual(await page.evaluate(`window.fit.proposeDimensions()`), {
        cols: 2,
        rows: 1
      });
    });

    it('hidden', async function(): Promise<any> {
      await page.evaluate(`window.term.dispose()`);
      await page.evaluate(`document.querySelector('#terminal-container').style.display='none'`);
      await page.evaluate(`window.term = new Terminal()`);
      await page.evaluate(`window.term.open(document.querySelector('#terminal-container'))`);
      await loadFit();
      assert.equal(await page.evaluate(`window.fit.proposeDimensions()`), undefined);
    });
  });

  describe('fit', () => {
    afterEach(async () => {
      return unloadFit();
    });

    it('default', async function(): Promise<any> {
      await loadFit();
      await page.evaluate(`window.fit.fit()`);
      const cols: number = await page.evaluate(`window.term.cols`);
      const rows: number = await page.evaluate(`window.term.rows`);
      assert.equal(cols, 87);
      assert.isAbove(rows, 24);
      assert.isBelow(rows, 29);
    });

    it('width', async function(): Promise<any> {
      await loadFit(1008);
      await page.evaluate(`window.fit.fit()`);
      const cols: number = await page.evaluate(`window.term.cols`);
      const rows: number = await page.evaluate(`window.term.rows`);
      assert.equal(cols, 110);
      assert.isAbove(rows, 24);
      assert.isBelow(rows, 29);
    });

    it('small', async function(): Promise<any> {
      await loadFit(1, 1);
      await page.evaluate(`window.fit.fit()`);
      assert.equal(await page.evaluate(`window.term.cols`), 2);
      assert.equal(await page.evaluate(`window.term.rows`), 1);
    });
  });
});

async function loadFit(width: number = 800, height: number = 450): Promise<void> {
  await page.evaluate(`
    window.fit = new FitAddon();
    window.term.loadAddon(window.fit);
    document.querySelector('#terminal-container').style.width='${width}px';
    document.querySelector('#terminal-container').style.height='${height}px';
  `);
}

async function unloadFit(): Promise<void> {
  await page.evaluate(`window.fit.dispose();`);
}
