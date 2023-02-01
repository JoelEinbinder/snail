export * from '@playwright/test';
import { test as _test, _baseTest, _electron, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { ShellModel } from './ShellModel';
import {spawn, execSync} from 'child_process';
import getPort from 'get-port';
type SshAddress = {
  address: string,
  port: number,
};

export const test = _test.extend<{
  shell: ShellModel,
  workingDir: string;
  tmpDirForTest: string;
  docker: SshAddress;
}, {
  imageId: string;
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
  imageId: [async ({ }, use) => {
    const imageId = 'snail:tests';
    execSync(`docker build --tag=${imageId} --file=./Dockerfile .`, {
      cwd: path.join(__dirname, 'docker'),
      stdio: 'ignore',
    });
    await use(imageId);
  }, { scope: 'worker' }],
  docker: async ({ imageId }, use) => {
    const port = await getPort();
    const docker = spawn('docker', ['run', '--rm', '-p', `${port}:22`, imageId], {
      stdio: 'pipe',
      cwd: path.join(__dirname, 'docker'),
    });
    await new Promise(x => setTimeout(x, 300));
    await use({ address: 'snailuser@localhost', port });
    docker.kill();
  },
  shell: async ({ headless, workingDir, tmpDirForTest }, use) => {
    const args: string[] = [];
    if (headless)
      args.push('--test-headless');
    const app = await _electron.launch({
      args: [path.join(__dirname, '..'), ...args],
      cwd: workingDir,
      env: {
        ...process.env,
        SNAIL_TEST_HOME_DIR: workingDir,
        SNAIL_TEST_TMP_DIR: tmpDirForTest,
        SNAIL_TEST_USER_DATA_DIR: test.info().outputPath('user-data-dir'),
      },
    });
    await app.context().tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    const page = await app.firstWindow();
    const shell = await ShellModel.create(page);
    await use(shell);
    await app.context().tracing.stop({
      path: test.info().outputPath('trace.pwtrace')
    });
    const waits = (await shell.currentWaits()).join('\n');
    if (waits) {
      test.info().attach('waits', {
        body: waits,
      });
    }
    await app.close();
  }
});
export default test;