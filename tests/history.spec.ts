import { test, expect } from './fixtures';

test('should have history', async ({ shell }) => {
  await shell.runCommand('echo hello');
  await shell.historyUp();
  expect(await shell.serialize()).toEqual({
    log: [
      '> echo hello',
      'hello',
    ],
    prompt: {
      value: 'echo hello',
    }
  });
});

test('should have separate history', async ({ shell }) => {
  const [left, right] = await shell.splitHorizontally();
  await left.runCommand('echo left');
  await right.runCommand('echo right');
  await left.historyUp();
  await right.historyUp();
  expect(await left.serialize()).toEqual({
    log: [
      '> echo left',
      'left',
    ],
    prompt: {
      value: 'echo left',
    }
  });
  expect(await right.serialize()).toEqual({
    log: [
      '> echo right',
      'right',
    ],
    prompt: {
      value: 'echo right',
    }
  });
});

test('should have shared history', async ({ shell }) => {
  const [left, right] = await shell.splitHorizontally();
  await left.runCommand('echo left');
  await left.historyUp();
  await right.historyUp();
  expect((await left.serialize()).prompt.value).toEqual('echo left');
  expect((await right.serialize()).prompt.value).toEqual('echo left');
  await right.historyDown();
  expect((await right.serialize()).prompt.value).toEqual('');
  await right.runCommand('echo right');
  await right.historyUp();
  expect((await right.serialize()).prompt.value).toEqual('echo right');
  await right.historyUp();
  expect((await right.serialize()).prompt.value).toEqual('echo left');
  await right.historyUp(); // beep
  expect((await right.serialize()).prompt.value).toEqual('echo left');
  await right.historyDown();
  expect((await right.serialize()).prompt.value).toEqual('echo right');
  await right.historyDown();
  expect((await right.serialize()).prompt.value).toEqual('');
  await right.historyDown(); // beep
  expect((await right.serialize()).prompt.value).toEqual('');
});

test('should use the prefix', async ({ shell }) => {
  await shell.runCommand('echo a one');
  await shell.runCommand('echo b one');
  await shell.runCommand('echo a two');
  await shell.runCommand('echo b two');
  await shell.runCommand('echo a three');
  await shell.runCommand('echo b three');
  await shell.historyUp();
  expect((await shell.serialize()).prompt.value).toEqual('echo b three');
  await shell.historyDown();
  await shell.typeInPrompt('echo a');
  await shell.historyUp();
  expect((await shell.serialize()).prompt.value).toEqual('echo a three');
  await shell.historyUp();
  expect((await shell.serialize()).prompt.value).toEqual('echo a two');
  await shell.historyUp();
  expect((await shell.serialize()).prompt.value).toEqual('echo a one');
  await shell.historyUp(); // beep
  expect((await shell.serialize()).prompt.value).toEqual('echo a one');
  await shell.historyDown();
  expect((await shell.serialize()).prompt.value).toEqual('echo a two');
  await shell.historyDown();
  expect((await shell.serialize()).prompt.value).toEqual('echo a three');
  await shell.historyDown();
  expect((await shell.serialize()).prompt.value).toEqual('echo a');
});