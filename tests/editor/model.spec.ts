import { Model } from '../../slug/editor/js/model'
import { test, expect } from '../fixtures';
const { describe } = test;

describe('text', () => {
  test('should take a subrange', async ({}) => {
    const model = new Model('this is the text');
    assertEqual(model.text(), 'this is the text');
    assertEqual(model.text({ start: { line: 0, column: 'this '.length }, end: { line: 0, column: 'this is'.length } }), 'is');
  });

  test('should work with a bunch of lines', async ({}) => {
    const model = new Model('hello\n'.repeat(5));
    // rasterize some random line for safety
    assertEqual(model.line(3).text, 'hello');
    assertEqual(model.text(), 'hello\n'.repeat(5));
  });

  test('should work with \\r\\n lines', async ({}) => {
    const model = new Model('hello\r\n'.repeat(5));
    // rasterize some random line for safety
    assertEqual(model.line(3).text, 'hello');
    assertEqual(model.text(), 'hello\r\n'.repeat(5));
  });

  test('should work with an empty document', async ({}) => {
    const model = new Model('');
    assertEqual(model.text(), '');
    model.line(0).text;
    assertEqual(model.text(), '');
  });
});

describe('lineCount', () => {
  test('should work', async ({}) => {
    assertEqual(new Model('').lineCount(), 1);
    assertEqual(new Model('\n').lineCount(), 2);
    assertEqual(new Model('1').lineCount(), 1);
    assertEqual(new Model('hi\n'.repeat(5)).lineCount(), 6);
    assertEqual(new Model('hi\r\n'.repeat(5)).lineCount(), 6);
  });

  test('should work after changing the text', async ({}) => {
    const model = new Model('hi\nbye');
    assertEqual(model.lineCount(), 2);
    model.replaceRange('hello\ngoodbye\nok', model.fullRange());
    assertEqual(model.text(), 'hello\ngoodbye\nok');
  });
});

test('fullRange', async ({}) => {
  const model = new Model('two\nlines');
  expect(model.fullRange()).toEqual({ start: { line: 0, column: 0 }, end: { line: 1, column: 'lines'.length } });
});

test('replace range', async ({}) => {
  const model = new Model('this is the text');
  model.replaceRange('was', { start: { line: 0, column: 'this '.length }, end: { line: 0, column: 'this is'.length } });
  assertEqual(model.text(), 'this was the text');
});

describe('search', () => {
  test('should work', async ({}) => {
    const model = new Model('Hello World!');
    expect(model.search('World')).toEqual({ line: 0, column: 'Hello '.length });
  });
});

function assertEqual<T>(a: T, b: T) {
  expect(a).toBe(b);
}