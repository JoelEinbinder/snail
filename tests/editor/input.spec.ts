import { test, expect } from '../fixtures';
import type { Editor, TextRange } from '../../slug/editor/js/editor';
test('input events come in correctly', async ({ shell }) => {
  await shell.runCommand('kang a.txt');
  expect(await shell.serialize()).toEqual({
    content: '',
    title: 'a.txt',
  });
  const eventsHandle = await shell.activeFrame().evaluateHandle(() => {
    const editor = window['editorForTest'] as Editor;
    const events: {text: string, range: TextRange}[] = [];
    editor.on('change', event => {
      events.push(event);
    });
    return events;
  });
  await shell.page.keyboard.type('a');
  expect(await eventsHandle.jsonValue()).toEqual([{
    text: 'a',
    range: {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    },
  }]);
  await shell.page.keyboard.press('ArrowLeft');
  await shell.page.keyboard.type('a');
  expect(await eventsHandle.jsonValue()).toEqual([{
    text: 'a',
    range: {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    },
  }, {
    text: 'a',
    range: {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    },
  }]);
  expect(await shell.serialize()).toEqual({
    content: 'aa',
    title: 'a.txt*',
  });
});