import { test, expect } from './fixtures';

test('should execute the ai when triggered', async ({shell}) => {
  await shell.enableMockAI();
  await shell.runCommand('echo hello');
  await shell.triggerLLM();
  expect(await shell.serialize()).toEqual({
    log: [ '> echo hello', 'hello' ],
    prompt: { value: '# fake ai suggestion' }
  });
});
test('should execute the ai on errors', async ({shell}) => {
  await shell.enableMockAI();
  await shell.runCommand('fail_to_find_this');
  expect(await shell.serialize()).toEqual({
    log: [ '> fail_to_find_this', 'command not found: fail_to_find_this' ],
    prompt: { value: '# fake ai suggestion' }
  });
});
test('should not execute the ai when there is no error', async ({shell}) => {
  await shell.enableMockAI();
  await shell.runCommand('echo hello');
  expect(await shell.serialize()).toEqual({
    log: [ '> echo hello', 'hello' ],
    prompt: { value: '' }
  });
});
test('should not execute the ai when there is an error that has been seen before', async ({shell}) => {
  await shell.enableMockAI();
  await shell.runCommand('fail_to_find_this');
  await shell.runCommand('clear');
  await shell.runCommand('fail_to_find_this');
  expect(await shell.serialize()).toEqual({
    log: [ '> fail_to_find_this', 'command not found: fail_to_find_this' ],
    prompt: { value: '' }
  });
});