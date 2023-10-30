export * from '@playwright/test';
import { test as _test, _electron, expect, type ElectronApplication } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { ShellModel } from './ShellModel';
import {spawn, execSync} from 'child_process';
import getPort from 'get-port';
import net from 'net';
import http from 'http';
import { buildSlugIfNeeded } from '../utils/build-slug-if-needed.js';
type SshAddress = {
  address: string,
  port: number,
};

export const test = _test.extend<{
  shell: ShellModel,
  electronApp: ElectronApplication,
  shellFactory: () => Promise<ShellModel>,
  workingDir: string;
  tmpDirForTest: string;
  docker: SshAddress;
  waitForPort: (port: number) => Promise<void>;
  shellInDocker: ShellModel;
  populateFilesystem: (files: { [filePath: string]: string }) => Promise<void>;
}, {
  imageId: string|null;
  slugURL: string;
  nodeURL: string;
}>({
  workingDir: async ({ }, use) => {
    const workingDir = test.info().outputPath('working-dir');
    await fs.promises.mkdir(workingDir, { recursive: true });
    await use(workingDir);
  },
  tmpDirForTest: async ({ workingDir }, use) => {
    const tmpDir = await fs.promises.mkdtemp(path.join(require('os').tmpdir(), 'snail-temp-'));
    await use(tmpDir);
    const entries = await fs.promises.readdir(path.join(tmpDir, 'snail-sockets'));
    if (entries.length)
      console.warn('some sockets still open', entries);
    for (const entry of entries.filter(x => x.endsWith('.json')))
      console.log(await fs.readFileSync(path.join(tmpDir, 'snail-sockets', entry), 'utf8'));
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  },
  imageId: [async ({ }, use) => {
    const imageId = 'snail:tests';
    try {
      execSync(`docker build --tag=${imageId} --file=./Dockerfile .`, {
        cwd: path.join(__dirname, 'docker'),
        stdio: 'ignore',
      });
    } catch {
      await use(null);
      return;
    }
    await use(imageId);
  }, { scope: 'worker' }],
  waitForPort: async ({}, use) => {
    /**
     * Copyright (c) Microsoft Corporation.
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     */
    const token = { canceled: false };
    await use(async port => {
      while (!token.canceled) {
        const promise = new Promise<boolean>(resolve => {
          const conn = net.connect(port, '127.0.0.1')
              .on('error', () => resolve(false))
              .on('connect', () => {
                conn.end();
                resolve(true);
              });
        });
        if (await promise)
          return;
        await new Promise(x => setTimeout(x, 100));
      }
    });
    token.canceled = true;
  },
  nodeURL: [async ({}, use) => {
    const nodesDir = path.join(__dirname, 'cached-nodes');
    const supportedNodes = ['v18.14.0/node-v18.14.0-linux-arm64.tar.gz'];
    for (const node of supportedNodes) {
      const nodePath = path.join(nodesDir, node);
      if (fs.existsSync(path.join(nodesDir, node)))
        continue;
      const dirname = path.dirname(nodePath);
      await fs.promises.mkdir(dirname, { recursive: true });
      execSync(`curl -o ${path.basename(node)} https://nodejs.org/dist/${node}`, { cwd: dirname, stdio: 'inherit' });
    }
    const server = http.createServer((req, res) => {
      const nodePath = path.join(nodesDir, req.url!);
      if (!nodePath.startsWith(nodesDir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(200);
      fs.createReadStream(nodePath).pipe(res);
    });
    server.listen();
    await new Promise(x => server.once('listening', x));
    const port: number = (server.address() as any).port;
    await use(`http://localhost:${port}`);
    server.close();
  }, { scope: 'worker', option: true, timeout: 30_000 }],
  slugURL: [async ({}, use) => {
    await buildSlugIfNeeded('linux', 'arm64');
    const server = http.createServer((req, res) => {
      const slugsDir = path.join(__dirname, '..', 'utils', 'built-slugs');
      const slugPath = path.join(slugsDir, req.url!);
      if (!slugPath.startsWith(slugsDir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.writeHead(200);
      fs.createReadStream(slugPath).pipe(res);
    });
    server.listen();
    await new Promise(x => server.once('listening', x));
    const port: number = (server.address() as any).port;
    await use(`http://localhost:${port}`);
    server.close();
  }, { scope: 'worker', option: true, timeout: 30_000 }],
  docker: async ({ imageId, waitForPort }, use, info) => {
    if (!imageId) {
      info.skip();
      return;
    }
    const port = await getPort();
    const docker = spawn('docker', ['run', '--rm', '-p', `${port}:22`, imageId], {
      stdio: 'pipe',
      cwd: path.join(__dirname, 'docker'),
    });
    await waitForPort(port);
    await use({ address: 'snailuser@localhost', port });
    docker.kill();
  },
  electronApp: async ({ headless, workingDir, tmpDirForTest }, use) => {
    const args: string[] = [];
    if (headless)
      args.push('--test-headless');
    args.push('--no-first-window');
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
    const err: Buffer[] = [];
    app.process().stderr?.on('data', data => err.push(data));
    await app.context().tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    await use(app);
    await app.context().tracing.stop({
      path: test.info().outputPath('trace.pwtrace')
    });
    if (err.length) {
      test.info().attach('electron-err', {
        body: err.map(err => err.toString('utf8')).join(''),
      });
    }
    await app.close();
  },
  shellFactory: async ({ electronApp }, use) => {
    const shells = new Set<ShellModel>();
    const logs: string[] = [];
    await use(async () => {
      const [page] = await Promise.all([
        electronApp.waitForEvent('window'),
        electronApp.evaluate(() => global.makeWindow())
      ]);
      page.on('console', log => {
        logs.push(log.text());
      });
      page.on('pageerror', event => {
        logs.push(event.message);
        if (event.stack)
          logs.push(event.stack);
      });
      const shell = await ShellModel.create(page);
      shells.add(shell);
      page.once('close', () => shells.delete(shell));
      return shell;
    });
    const waits = (await Promise.all([...shells].map(shell => shell.currentWaits()))).flat().join('\n');
    if (waits) {
      test.info().attach('waits', {
        body: waits,
      });
    }
    if (logs.length) {
      test.info().attach('console', {
        body: logs.join('\n'),
      });      
    }
    for (const shell of shells)
      await shell.kill();
  },
  shell: async ({ shellFactory }, use) => {
    await use(await shellFactory());
  },
  shellInDocker: async ({ shell, slugURL, docker, nodeURL }, use) => {
    const extraArgs:string[] = [];

    let SNAIL_SLUGS_URL = slugURL; 
    const parsedSlugURL = new URL(slugURL);
    if (parsedSlugURL.hostname === 'localhost') {
      SNAIL_SLUGS_URL = `http://localhost:${parsedSlugURL.port}`;
      extraArgs.push('-R', `${parsedSlugURL.port}:localhost:${parsedSlugURL.port}`)
    }
    let SNAIL_NODE_URL = nodeURL; 
    const parsedNodeURL = new URL(nodeURL);
    if (parsedNodeURL.hostname === 'localhost') {
      SNAIL_NODE_URL = `http://localhost:${parsedNodeURL.port}`;
      extraArgs.push('-R', `${parsedNodeURL.port}:localhost:${parsedNodeURL.port}`)
    }
    const sshCommand = [
      `SNAIL_SLUGS_URL=${JSON.stringify(SNAIL_SLUGS_URL)}`,
      `SNAIL_NODE_URL=${JSON.stringify(SNAIL_NODE_URL)}`,
      `ssh2`,
      ...extraArgs,
      // ConnectionAttempts because sshd really doesnt start up when it says it starts up
      `-o ConnectionAttempts=10`,
      `-o UserKnownHostsFile=/dev/null`,
      `-o StrictHostKeyChecking=no`,
      `-o LogLevel=ERROR`,
      docker.address,
      `-p ${docker.port}`
    ].join(' ');
    await shell.runCommand(sshCommand);
    await shell.page.keyboard.type('mypassword');
    await shell.page.keyboard.press('Enter');  
    await shell.waitForAsyncWorkToFinish();

    expect(await shell.serialize()).toEqual({
      log: [
        `> ${sshCommand}`,
        { input: '<password>', message: `${docker.address}'s password: `},
        'Downloading snail runtime...\n' +
        'Downloading node for Linux aarch64...',
      ],
      prompt: { value: '' }
    });
    await shell.runCommand('clear');
    await use(shell);
  },
  populateFilesystem: async ({ workingDir }, use) => {
    await use(async files => {
      await Promise.all(Object.entries(files).map(async ([name, content]) => {
        const filePath = path.join(workingDir, name);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, content, 'utf8');
      }));
    });
  },
});
export default test;