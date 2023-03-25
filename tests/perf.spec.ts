import { test, expect } from './fixtures';
import fs from 'fs';
import path from 'path';

test('quickly render a big file', async ({ shell, workingDir }) => {
  const array: string[] = [];
  for (let i = 0; i < 100000; i++)
    array.push(`line ${i}`);
  const content = array.join('\n');
  fs.writeFileSync(path.join(workingDir, 'big.txt'), content);
  await test.step('render big file', async () => {
    await shell.runCommand('cat big.txt');
  });
  expect(await shell.serialize()).toEqual({
    log: [
      '> cat big.txt',
      array.slice(-50000).join('\n'),
    ],
    prompt: { value: '' },
  });
});
