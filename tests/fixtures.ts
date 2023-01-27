export * from '@playwright/test';
import { test as _test, _baseTest, _electron, type Page } from '@playwright/test';
import path from 'path';
import { ShellModel } from './ShellModel';

export const test = _test.extend<{
  shell: ShellModel,
}>({
  shell: async ({ headless }, use) => {
    const args: string[] = [];
    if (headless)
      args.push('--test-headless');
    const app = await _electron.launch({
      args: [path.join(__dirname, '..'), ...args],
    });
    const page = await app.firstWindow();
    const shell = await ShellModel.create(page);
    await use(shell);
    await app.close();
  }
});
export default test;