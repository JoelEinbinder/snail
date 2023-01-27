import { test, expect } from './fixtures';

test('can run a command', async ({ shell }) => {
  await shell.runCommand('echo hello');
  expect(await shell.serialize()).toEqual({
    log: [
      '> echo hello',
      'hello'
    ],
    prompt: true
  });
});
