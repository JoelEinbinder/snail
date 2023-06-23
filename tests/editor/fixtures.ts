export * from '@playwright/test';
import { test as _test, _electron, expect, type Page } from '@playwright/test';
import path from 'path';
import { createDevServer } from '../../electron-dev/'
import { EditorModel } from './EditorModel';
export const test = _test.extend<{
  editor: EditorModel,
}, {
  editorURL: string,
}>({
  editor: async ({ page, editorURL }, use) => {
    await page.goto(editorURL);
    await use(await EditorModel.create(page));
  },
  editorURL: [async ({}, use) => {
    const {url, close} = await createDevServer(path.join(__dirname, './editorEntry.ts'));
    await use(url);
    close();
  }, { scope: 'worker' }],
});
export default test;