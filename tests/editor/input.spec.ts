import { test, expect } from '../fixtures';
import type { Editor, TextRange } from '../../slug/editor/js/editor';
test('input events come in correctly', async ({ shell }) => {
  await shell.runCommand('kang a.txt');
  await shell.hackToEnsureKeyboardFocusIsOnFrame();
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
  await shell.kill();
});
test('should type correctly after a big paste', async ({ shell }) => {
  await shell.runCommand('kang a.txt');
  await shell.hackToEnsureKeyboardFocusIsOnFrame();
  expect(await shell.serialize()).toEqual({
    content: '',
    title: 'a.txt',
  });
  const longText = 'a'.repeat(4500);
  await shell.page.keyboard.insertText(longText);
  await shell.page.keyboard.type(`'`);
  expect(await shell.serialize()).toEqual({
    content: longText + `'`,
    title: 'a.txt*',
  });
  await shell.kill();
});
test('should type correctly after ArrowLeft', async ({ shell }) => {
  await shell.runCommand('kang a.txt');
  await shell.hackToEnsureKeyboardFocusIsOnFrame();
  await shell.page.keyboard.type('123');
  await shell.page.keyboard.press('ArrowLeft');
  await shell.page.keyboard.type('a');
  expect(await shell.serialize()).toEqual({
    content: '12a3',
    title: 'a.txt*',
  });
  await shell.kill();
});

test('should do a line comment', async ({ shell }) => {
  await shell.runCommand('kang a.js');
  await shell.hackToEnsureKeyboardFocusIsOnFrame();
  await shell.page.keyboard.type('123\n456');
  await shell.page.keyboard.press('ControlOrMeta+KeyA');
  await shell.page.keyboard.press('ControlOrMeta+Slash');
  expect(await shell.serialize()).toEqual({
    content: '// 123\n// 456',
    title: 'a.js*',
  });
  await shell.kill();
});
