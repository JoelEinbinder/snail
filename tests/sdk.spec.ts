import { expect, test } from './fixtures';
import path from 'path';

test('use the sdk to display some web content', async ({ shell, populateFilesystem, workingDir }) => {
  await populateFilesystem({
    'backend.js': `
      const sdk = require(${JSON.stringify(require.resolve('../slug/sdk'))});
      sdk.display(${JSON.stringify(path.join(workingDir, 'web.ts'))});
    `,
    'web.ts': `
      d4.setToJSON({ hello: 'world' });
      d4.setHeight(100);
    `,
  });
  await shell.runCommand('node backend.js');
  expect(await shell.serialize()).toEqual({
    log: [
      '> node backend.js',
      { hello: 'world'},
    ],
    prompt: { value: '' },
  });
});

test('have a nice error message on build failure', async ({ shell, populateFilesystem, workingDir }) => {
  await populateFilesystem({
    'backend.js': `
      const sdk = require(${JSON.stringify(require.resolve('../slug/sdk'))});
      sdk.display(${JSON.stringify(path.join(workingDir, 'web.ts'))});
    `,
    'web.ts': `
      import { foo } from './not-a-real-file';
      foo();
      d4.setToJSON({ hello: 'world' });
      d4.setHeight(100);
    `,
  });
  await shell.runCommand('node backend.js');
  const serialized = await shell.serialize();
  expect(serialized.log[1].error).toContain('ERROR: Could not resolve \"./not-a-real-file\"');
});