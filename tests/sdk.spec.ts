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

test('show a progress bar', async ({ shell, populateFilesystem, workingDir }) => {
  await populateFilesystem({
    'backend.js': `
      const sdk = require(${JSON.stringify(require.resolve('../slug/sdk'))});
      sdk.setProgress({ progress: 0.4, leftText: 'foo', rightText: 'bar' });
    `,
  });
  await shell.runCommand('node backend.js');
  expect(await shell.serialize()).toEqual({
    log: [
      '> node backend.js',
      { type: 'progress', left: 'foo', value: 0.4, right: 'bar' },
    ],
    prompt: { value: '' }
  })
});

test('show a progress bar between some logs', async ({ shell, populateFilesystem, workingDir }) => {
  await populateFilesystem({
    'backend.js': `
      const sdk = require(${JSON.stringify(require.resolve('../slug/sdk'))});
      console.log('before progress bar');
      sdk.setProgress({ progress: 0.4, leftText: 'foo', rightText: 'bar' });
      console.log('after progress bar');
    `,
  });
  await shell.runCommand('node backend.js');
  expect(await shell.serialize()).toEqual({
    log: [
      '> node backend.js',
      'before progress bar',
      { type: 'progress', left: 'foo', value: 0.4, right: 'bar' },
      'after progress bar',
    ],
    prompt: { value: '' }
  })
});
