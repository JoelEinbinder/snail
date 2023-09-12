import { test, expect } from './fixtures';
import os from 'os';
test('should start with selection at the start', async ({ editor }) => {
  await editor.setValue('hello world');
  expect(await editor.serialize()).toEqual(
    'hello world\n' +
    '^           ');
});
test('should be able to select a word with double click', async ({ editor }) => {
  await editor.setValue('hello world');
  const { x, y } = await editor.pointFromLocation({ line: 0, column: 8 });  
  await editor.page.mouse.dblclick(x, y);
  expect(await editor.serialize()).toEqual(
    'hello world\n' +
    '      [----]');
});
test('should be able to select a line with a triple click', async ({ editor }) => {
  await editor.setValue('hello world');
  const { x, y } = await editor.pointFromLocation({ line: 0, column: 8 });  
  await editor.page.mouse.click(x, y, { clickCount: 3 });
  expect(await editor.serialize()).toEqual(
    'hello world\n' +
    '[----------]');
});
test('should be able to move horizontally with the arrow keys', async ({ editor }) => {
  await editor.setValue('hello world');
  expect(await editor.serialize()).toEqual(
    'hello world\n' +
    '^           ');
  await editor.page.keyboard.press('ArrowRight');
  await editor.page.keyboard.press('ArrowRight');
  expect(await editor.serialize()).toEqual(
      'hello world\n' +
      '  ^         ');
  await editor.page.keyboard.press('ArrowLeft');
  expect(await editor.serialize()).toEqual(
      'hello world\n' +
      ' ^          ');
});
test('should be able to move vertically with the arrow keys', async ({ editor }) => {
  await editor.setValue('hello world\n1234567890\nabcdefghijklmnopqrstuvwxyz');
  await editor.page.keyboard.press('ArrowRight');
  await editor.page.keyboard.press('ArrowRight');
  expect(await editor.serialize()).toEqual(
      'hello world\n' +
      '  ^         \n' + 
      '1234567890\n' + 
      'abcdefghijklmnopqrstuvwxyz');
  await editor.page.keyboard.press('ArrowDown');
  await editor.page.keyboard.press('ArrowDown');
  expect(await editor.serialize()).toEqual(
      'hello world\n' +
      '1234567890\n' + 
      'abcdefghijklmnopqrstuvwxyz\n' +
      '  ^                        ');
  await editor.page.keyboard.press('ArrowUp');
  expect(await editor.serialize()).toEqual(
    'hello world\n' +
    '1234567890\n' + 
    '  ^        \n' + 
    'abcdefghijklmnopqrstuvwxyz');
});
test('should keep preserved x position when moving vertically', async ({ editor }) => {
  await editor.setValue('a short line\na very very very long line\nanother short line\nanother very very long line');
  await editor.page.keyboard.press('ArrowDown');
  for (let i = 0; i < 22; i++)
    await editor.page.keyboard.press('ArrowRight');
  expect(await editor.serialize()).toEqual(
      'a short line\n' +
      'a very very very long line\n' + 
      '                      ^    \n' + 
      'another short line\n' +
      'another very very long line');
  await editor.page.keyboard.press('ArrowDown');
  expect(await editor.serialize()).toEqual(
    'a short line\n' +
    'a very very very long line\n' + 
    'another short line\n' +
    '                  ^\n' + 
    'another very very long line');
  await editor.page.keyboard.press('ArrowDown');
  expect(await editor.serialize()).toEqual(
    'a short line\n' +
    'a very very very long line\n' + 
    'another short line\n' +
    'another very very long line\n' +
    '                      ^     ');
  await editor.page.keyboard.press('ArrowDown');
});

test('should move by word', async ({ editor }) => {
  const rightKey = os.platform() === 'darwin' ? 'Alt+ArrowRight' : 'Control+ArrowRight';
  const leftKey = os.platform() === 'darwin' ? 'Alt+ArrowLeft' : 'Control+ArrowLeft';
  await editor.setValue('these are my words');
  await editor.page.keyboard.press(rightKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '     ^             ');
  await editor.page.keyboard.press(rightKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '         ^         ');
  await editor.page.keyboard.press(rightKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '            ^      ');
  await editor.page.keyboard.press(leftKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '          ^        ');
  await editor.page.keyboard.press(leftKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '      ^            ');
  await editor.page.keyboard.press(leftKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '^                  ');
});
test('should select by word', async ({ editor }) => {
  const rightKey = os.platform() === 'darwin' ? 'Shift+Alt+ArrowRight' : 'Shift+Control+ArrowRight';
  const leftKey = os.platform() === 'darwin' ? 'Shift+Alt+ArrowLeft' : 'Shift+Control+ArrowLeft';
  await editor.setValue('these are my words');
  await editor.page.keyboard.press(rightKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '[----]             ');
  await editor.page.keyboard.press(rightKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '[--------]         ');
  await editor.page.keyboard.press(rightKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '[-----------]      ');
  await editor.page.keyboard.press(leftKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '[---------]        ');
  await editor.page.keyboard.press(leftKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '[-----]            ');
  await editor.page.keyboard.press(leftKey);
  expect(await editor.serialize()).toEqual(
    'these are my words\n' +
    '^                  ');
});
test.fixme('should mutli select and edit and move', async ({ editor }) => {
  const selectWord = os.platform() === 'darwin' ? 'Meta+D' : 'Control+D';
  editor.setValue('a cat and a cat saw a cat');
  await editor.setSelection({ start: {line: 0, column: 2}, end: {line: 0, column: 2}});
  expect(await editor.serialize()).toEqual(
    'a cat and a cat saw a cat\n' +
    '  ^                       ');
  await editor.page.keyboard.press(selectWord);
  expect(await editor.serialize()).toEqual(
    'a cat and a cat saw a cat\n' +
    '  [--]                    ');
  await editor.page.keyboard.press(selectWord);
  expect(await editor.serialize()).toEqual(
    'a cat and a cat saw a cat\n' +
    '  [--]      [--]          ');
  await editor.page.keyboard.press(selectWord);
  expect(await editor.serialize()).toEqual(
    'a cat and a cat saw a cat\n' +
    '  [--]      [--]      [--]');
  await editor.page.keyboard.type('dog');
  expect(await editor.serialize()).toEqual(
    'a dog and a dog saw a dog\n' +
    '     ^         ^         ^');
  await editor.page.keyboard.press('ArrowLeft');
  expect(await editor.serialize()).toEqual(
    'a dog and a dog saw a dog\n' +
    '    ^         ^         ^ ');
});
test.describe('word wrap', () => {
  test.beforeEach(async ({ editor }) => {
    editor.setEditorColumns(10);
  });
  test('should wrap', async ({ editor }) => {
    await editor.setValue('1234567890\nabcdefghijklmnopqrstuvwxyz\nABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(await editor.screenshot()).toMatchSnapshot();
  });
});