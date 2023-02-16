import { test, expect } from './fixtures';

test('can run an app', async ({ shell }) => {
  await shell.runCommand('html "<b>hello</b>"');
  expect(await shell.serialize()).toEqual({
    log: [
      '> html "<b>hello</b>"',
      'HTML: <b>hello</b>',
    ],
    prompt: { value: '' },
  });
});

test('can run an app in docker', async ({ shellInDocker }) => {
  await shellInDocker.runCommand('html "<b>hello</b>"');
  expect(await shellInDocker.serialize()).toEqual({
    log: [
      '> html "<b>hello</b>"',
      'HTML: <b>hello</b>',
    ],
    prompt: { value: '' },
  });
});