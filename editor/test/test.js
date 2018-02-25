const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

let page;
let browser;
before(async function () {
  browser = await puppeteer.launch();
  page = await browser.newPage();
});

beforeEach(async function () {
  await page.goto('about:blank');
  await page.evaluate(code => {
    eval('window.assertEqual = ' + code);
  }, assertEqual.toString());
});

describe('model', function () {
  beforeEach(async function () {
    await loadScript('emitter.js');
    await loadScript('model.js');
  });
  describe('text', function () {
    it('should take a subrange', async function () {
      await page.evaluate(() => {
        const model = new Model('this is the text');
        assertEqual(model.text(), 'this is the text');
        assertEqual(model.text({ start: { line: 0, column: 'this '.length }, end: {line:0, column: 'this is'.length}}), 'is');
      });
    });
    it('should work with a bunch of lines', async function () {
      await page.evaluate(() => {
        const model = new Model('hello\n'.repeat(5));
        // rasterize some random line for safety
        model.line(3).text;
        assertEqual(model.text(), 'hello\n'.repeat(5));
      });
    });
  });
  it('fullRange', async function () {
    await page.evaluate(() => {
      const model = new Model('two\nlines');
      assertEqual(JSON.stringify(model.fullRange()), JSON.stringify({ start: { line: 0, column: 0 }, end: {line: 1, column: 'lines'.length}}));
    });
  });
  it('replace range', async function () {
    await page.evaluate(() => {
      const model = new Model('this is the text');
      model.replaceRange('was', { start: { line: 0, column: 'this '.length }, end: { line: 0, column: 'this is'.length } });
      assertEqual(model.text(), 'this was the text');
    });
  });
});

after(async function () {
  console.log('closing browser');
  await browser.close();
});

async function loadScript(scriptName) {
  await page.addScriptTag({ path: path.resolve(__dirname, '..', 'js', scriptName) });
}

function assertEqual(one, two) {
  if (one === two)
    return;
  throw new Error(`${JSON.stringify(one)} !== ${JSON.stringify(two)}`);
}