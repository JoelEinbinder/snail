import { test, expect } from './fixtures';
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
test.describe('word wrap', () => {
  test.beforeEach(async ({ editor }) => {
    editor.setEditorColumns(10);
  });
  test('should wrap', async ({ editor }) => {
    await editor.setValue('1234567890\nabcdefghijklmnopqrstuvwxyz\nABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(await editor.screenshot()).toMatchSnapshot();
  });
});