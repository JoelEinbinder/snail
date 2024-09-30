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

test('can find a file with quick pick', async ({ shell }) => {
  await shell.runCommand('mkdir dir && touch dir/fileToFind.txt');

  await shell.runCommand('clear');
  await shell.page.keyboard.type('cat ');
  await shell.openQuickOpen();
  await shell.page.keyboard.type('ToFind');
  await shell.page.keyboard.press('Enter');
  await shell.waitForAsyncWorkToFinish();
  expect(await shell.serialize()).toEqual({
    log: [],
    prompt: { value: 'cat dir/fileToFind.txt' },
  });
});

test('can type in the prompt after closing quick pick', async ({ shell }) => {
  await shell.openQuickOpen();
  await shell.page.keyboard.press('Escape');
  await shell.page.keyboard.type('you_should_see_me')
  await shell.waitForAsyncWorkToFinish();
  expect(await shell.serialize()).toEqual({
    log: [],
    prompt: { value: 'you_should_see_me' },
  });
});