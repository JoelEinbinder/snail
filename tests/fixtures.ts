export * from '@playwright/test';
import { test as _test, _baseTest, _electron, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { ShellModel } from './ShellModel';

export const test = _test.extend<{
  shell: ShellModel,
  workingDir: string;
  tmpDirForTest: string;
}>({
  workingDir: async ({ }, use) => {
    const workingDir = test.info().outputPath('working-dir');
    await fs.promises.mkdir(workingDir, { recursive: true });
    await use(workingDir);
  },
  tmpDirForTest: async ({ workingDir }, use) => {
    const tmpDir = await fs.promises.mkdtemp(path.join(require('os').tmpdir(), 'snail-temp-'));
    await use(tmpDir);
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  },
  shell: async ({ headless, workingDir, tmpDirForTest }, use) => {
    const args: string[] = [];
    if (headless)
      args.push('--test-headless');
    const app = await _electron.launch({
      args: [path.join(__dirname, '..'), ...args],
      env: {
        ...process.env,
        SNAIL_TEST_HOME_DIR: workingDir,
        SNAIL_TEST_TMP_DIR: tmpDirForTest,
      },
    });
    const page = await app.firstWindow();
    const shell = await ShellModel.create(page);
    await use(shell);
    await app.close();
  }
});
export default test;