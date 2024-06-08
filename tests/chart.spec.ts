import { test, expect } from './fixtures';
import fs from 'fs';
test('chart should work', async ({ shell, workingDir }) => {
  const script = `
  const { chart } = require(${JSON.stringify(require.resolve('../slug/sdk/'))});
  for (let i = 0; i < 50_000; i++)
    chart({foo: i});
  `;
  await fs.promises.writeFile(workingDir + '/script.js', script);
  await shell.runCommand(`node script.js`);
  const { log: [, chart]} = await shell.serialize();
  expect(chart).toEqual({
    foo: {
      x: [0, 49_999],
      y: [0, 49_999],
    }
  })
});
