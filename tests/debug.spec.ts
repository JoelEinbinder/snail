import { test, expect } from './fixtures';

// This is flaky, but the debugging feature is not real yet so disable for now.
test.fixme('debug some html', async ({ shell }) => {
  const [left, right] = await shell.splitHorizontally();
  await left.runCommand('html "<b>hello</b>"');
  await right.runCommand('debug');
  expect(await left.serialize()).toEqual({
    log: [
      '> html "<b>hello</b>"',
      'HTML: <b>hello</b>',
    ],
    prompt: { value: '' },
  });
  const serialized = await right.serialize();
  expect(serialized.tree).toContain('<b>hello</b>');
});

