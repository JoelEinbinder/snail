import { test, expect } from './fixtures';

test('can open quick pick', async ({ shell }) => {
  await shell.openQuickPick();
  expect(await shell.serialize()).toEqual({
    type: 'quick-pick',
    value: '>',
  });
  await shell.closeQuickPick();
  expect(await shell.serialize()).toEqual({
    log: [],
    prompt: { value: '' },
  });
});

test('can open quick pick when focus is on an iframe', async ({ shell }) => {
  await shell.runCommand('html "<button>hi</button>"');
  await shell.activeFrame().click('button');
  await shell.openQuickPick();
  expect(await shell.serialize()).toEqual({
    type: 'quick-pick',
    value: '>',
  });
});
