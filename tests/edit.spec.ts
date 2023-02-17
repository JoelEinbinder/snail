import { test, expect } from './fixtures';
import fs from 'fs';
import path from 'path';

test('can edit a new file', async ({ shell, workingDir }) => {
  await shell.runCommand('edit foo.js');
  expect(await shell.serialize()).toEqual({
    title: 'foo.js',
    content: '',
  });
  await shell.page.keyboard.type('hello world');
  expect(await shell.waitAndSerialize()).toEqual({
    title: 'foo.js*',
    content: 'hello world',
  });
  await shell.page.keyboard.press('Meta+KeyS');
  expect(await shell.waitAndSerialize()).toEqual({
    title: 'foo.js',
    content: 'hello world',
  });
  expect(await fs.promises.readFile(path.join(workingDir, 'foo.js'), 'utf8')).toEqual('hello world');
  await shell.page.keyboard.press('Control+C');
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
  await shell.runCommand('edit bar.txt');
  expect(await shell.serialize()).toEqual({
    title: 'bar.txt',
    content: 'old content\n',
  });
  await shell.page.keyboard.press('PageDown');
  await shell.page.keyboard.type('new content\n');
  expect(await shell.waitAndSerialize()).toEqual({
    title: 'bar.txt*',
    content: 'old content\nnew content\n',
  });
  await shell.page.keyboard.press('Meta+KeyS');
  expect(await shell.waitAndSerialize()).toEqual({
    title: 'bar.txt',
    content: 'old content\nnew content\n',
  });
  expect(await fs.promises.readFile(path.join(workingDir, 'bar.txt'), 'utf8')).toEqual('old content\nnew content\n');
  await shell.page.keyboard.press('Control+C');
  expect(await shell.waitAndSerialize()).toEqual({
    log: [
      '> edit bar.txt',
    ],
    prompt: {
      value: '',
    }
  });
});
