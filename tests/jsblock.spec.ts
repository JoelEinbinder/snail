import { test, expect } from './fixtures';

test('should preview a holey array', async ({ shell }) => {
  await shell.runCommand(`const x = []; x.length = 5; x.push('end'); x;`);
  const {log: [, result]} = await shell.serialize();
  expect(result).toEqual('[ <5 empty items>, \'end\' ]');
});
