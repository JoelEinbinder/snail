import { test, expect } from './fixtures';

test('should work', async ({ repl }) => {
  await repl.runCommand('2 + 3')
  await repl.runCommand('print("hello")')
  expect(await repl.serialize()).toEqual({
    log: [
      '<Intro Block>',
      '> 2 + 3',
      '5',
      '> print("hello")',
      'hello'
    ],
    prompt: { value: '' }
  })
});