import { test, expect } from './fixtures';
import fs from 'fs';
import path from 'path';
import os from 'os';

test('can edit a new file', async ({ shell, workingDir }) => {
  const editor = await shell.runCommand('edit foo.js');
  if (!editor)
    throw new Error('Expected edit to create a browser view');
  expect(await shell.serialize()).toEqual({
    title: 'foo.js',
    content: '',
  });
  await editor.keyboard.type('hello world');
  expect(await shell.waitAndSerialize()).toEqual({
    title: 'foo.js*',
    content: 'hello world',
  });
  await editor.keyboard.press(os.platform() === 'darwin' ? 'Meta+KeyS' : 'Control+KeyS');
  expect(await shell.waitAndSerialize()).toEqual({
    title: 'foo.js',
    content: 'hello world',
  });
  expect(await fs.promises.readFile(path.join(workingDir, 'foo.js'), 'utf8')).toEqual('hello world');
  await editor.keyboard.press('Control+C');
  expect(await shell.waitAndSerialize()).toEqual({
    log: [
      '> edit foo.js',
    ],
    prompt: {
      value: '',
    }
  });
});

test('can edit an existing file', async ({ shell, workingDir }) => {
  await fs.promises.writeFile(path.join(workingDir, 'bar.txt'), 'old content\n', 'utf8');
  const editor = await shell.runCommand('edit bar.txt');
  if (!editor)
    throw new Error('Expected edit to create a browser view');
  expect(await shell.serialize()).toEqual({
    title: 'bar.txt',
    content: 'old content\n',
  });
  await editor.keyboard.press('PageDown');
  await editor.keyboard.type('new content\n');
  expect(await shell.waitAndSerialize()).toEqual({
    title: 'bar.txt*',
    content: 'old content\nnew content\n',
  });
  await editor.keyboard.press(os.platform() === 'darwin' ? 'Meta+KeyS' : 'Control+KeyS');
  expect(await shell.waitAndSerialize()).toEqual({
    title: 'bar.txt',
    content: 'old content\nnew content\n',
  });
  expect(await fs.promises.readFile(path.join(workingDir, 'bar.txt'), 'utf8')).toEqual('old content\nnew content\n');
  await editor.keyboard.press('Control+C');
  expect(await shell.waitAndSerialize()).toEqual({
    log: [
      '> edit bar.txt',
    ],
    prompt: {
      value: '',
    }
  });
});

test('is set as the default editor', async ({ shell }) => {
  await shell.runCommand('$EDITOR foo.txt');
  expect(await shell.serialize()).toEqual({
    title: 'foo.txt',
    content: '',
  });
});

test('has a close button', async ({ shell, workingDir }) => {
  const editor = await shell.runCommand('edit foo.txt');
  if (!editor)
    throw new Error('Expected edit to create a browser view');
  expect(await shell.serialize()).toEqual({
    title: 'foo.txt',
    content: '',
  });
  await editor.locator('a.close').click();
  expect(await shell.waitAndSerialize()).toEqual({
    log: [
      '> edit foo.txt',
    ],
    prompt: {
      value: '',
    }
  });
});

test('can edit inside docker', async ({ shellInDocker }) => {
  await shellInDocker.runCommand('edit foo.txt');
  expect(await shellInDocker.serialize()).toEqual({
    title: 'foo.txt',
    content: '',
  });
});

test('can reconnect to edit', async ({ shellFactory }) => {
  const shell1 = await shellFactory();
  await shell1.runCommand('edit foo.txt');
  expect(await shell1.serialize()).toEqual({
    title: 'foo.txt',
    content: '',
  });
  await shell1.close();

  const shell2 = await shellFactory();
  await shell2.runCommand('reconnect');
  expect(await shell2.serialize()).toEqual({
    title: 'foo.txt',
    content: '',
  });
  await shell2.kill();
});


test('edit should not be slow the second time', async ({ shell }) => {
  const editor = await shell.runCommand('edit foo.txt');
  if (!editor)
    throw new Error('Expected edit to create a browser view');
  // catch because the page might close here
  await editor.keyboard.press('Control+C').catch(x => void 0);
  await shell.waitForAsyncWorkToFinish();
  const time = Date.now();
  await shell.runCommand('edit foo.txt');
  const elapsed = Date.now() - time;
  expect(elapsed).toBeLessThan(500);
});