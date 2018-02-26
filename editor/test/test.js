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
        assertEqual(model.line(3).text, 'hello');
        assertEqual(model.text(), 'hello\n'.repeat(5));
      });
    });
    it('should work with \\r\\n lines', async function () {
      await page.evaluate(() => {
        const model = new Model('hello\r\n'.repeat(5));
        // rasterize some random line for safety
        assertEqual(model.line(3).text, 'hello');
        assertEqual(model.text(), 'hello\r\n'.repeat(5));
      });
    });
    it('should work with an empty document', async function () {
      await page.evaluate(() => {
        const model = new Model('');
        assertEqual(model.text(), '');
        model.line(0).text;
        assertEqual(model.text(), '');
      });
    });
  });
  describe('lineCount', function () {
    it('should work', async function () {
      await page.evaluate(() => {
        assertEqual(new Model('').lineCount(), 1);
        assertEqual(new Model('\n').lineCount(), 2);
        assertEqual(new Model('1').lineCount(), 1);
        assertEqual(new Model('hi\n'.repeat(5)).lineCount(), 6);
        assertEqual(new Model('hi\r\n'.repeat(5)).lineCount(), 6);
      });
    });
    it('should work after changing the text', async function () {
      await page.evaluate(() => {
        const model = new Model('hi\nbye');
        assertEqual(model.lineCount(), 2);
        model.replaceRange('hello\ngoodbye\nok', model.fullRange());
        assertEqual(model.text(), 'hello\ngoodbye\nok');
      });
    });
  });
  it('fullRange', async function () {
    await page.evaluate(() => {
      const model = new Model('two\nlines');
      assertEqual(model.fullRange(), { start: { line: 0, column: 0 }, end: {line: 1, column: 'lines'.length}}, true);
    });
  });
  it('replace range', async function () {
    await page.evaluate(() => {
      const model = new Model('this is the text');
      model.replaceRange('was', { start: { line: 0, column: 'this '.length }, end: { line: 0, column: 'this is'.length } });
      assertEqual(model.text(), 'this was the text');
    });
  });
  describe('search', function () {
    it('should work', async function () {
      await page.evaluate(() => {
        const model = new Model('Hello World!');
        assertEqual(model.search('World'), { line: 0, column: 'Hello '.length }, true);
      });
    });
  })
});

after(async function () {
  console.log('closing browser');
  await browser.close();
});

async function loadScript(scriptName) {
  await page.addScriptTag({ path: path.resolve(__dirname, '..', 'js', scriptName) });
}

function assertEqual(one, two, soft) {
  if (soft) {
    var softOne = JSON.stringify(one);
    var softTwo = JSON.stringify(two);
    if (softOne === softTwo)
      return;
    throw new Error(`${JSON.stringify(softOne)} !== ${JSON.stringify(softTwo)}`);
  }
  if (one === two)
    return;
  throw new Error(`${JSON.stringify(one)} !== ${JSON.stringify(two)}`);
}