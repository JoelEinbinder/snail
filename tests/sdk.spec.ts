import { expect, test } from './fixtures';
import path from 'path';

test('use the sdk to display some web content', async ({ shell, populateFilesystem, workingDir }) => {
  await populateFilesystem({
    'backend.js': `
      const sdk = require(${JSON.stringify(require.resolve('../slug/sdk'))});
      sdk.display(${JSON.stringify(path.join(workingDir, 'web.ts'))});
    `,
    'web.ts': `
      snail.setToJSON({ hello: 'world' });
      snail.setHeight(100);
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
      snail.setToJSON({ hello: 'world' });
      snail.setHeight(100);
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
test('full screen content', async ({ shell, populateFilesystem, workingDir, headless }) => {
  await populateFilesystem({
    'backend.js': `
      const sdk = require(${JSON.stringify(require.resolve('../slug/sdk'))});
      sdk.display(${JSON.stringify(path.join(workingDir, 'web.ts'))});
      const rpc = sdk.makeRPC({
        async save({file, content}) {
          await fs.promises.writeFile(file, content);
        },
        async close(x) {
          console.log('closing');
          process.exit();
        }
      });
      rpc.notify('setContent', {
        content: 'content from the backend',
      });
    `,
    'web.ts': `
      document.body.textContent = 'This is some full screen content. Press any key to exit.';
      snail.setToJSON({ content: '<none>' });
      snail.setIsFullscreen(true);
      document.body.addEventListener('keydown', (event) => {
        if (!event.ctrlKey)
          return;
        if (event.code !== 'KeyC')
          return;
        lastMessageDone();
        snail.sendInput(JSON.stringify({ method: 'close' }) + '\\n');
        // this should be prevented by the user,
        // but if they dont we shouldnt put ctrl+c into the prompt
        // event.preventDefault();
      });
      window.onfocus = () => {
        document.body.style.backgroundColor = 'white';
      };
      let lastMessageDone = () => void 0;
      while (true) {
        const message = await snail.waitForMessage();
        snail.setToJSON({ message });
        lastMessageDone();
        lastMessageDone = snail.expectingUserInput();
      }
    `,
  });
  await shell.runCommand('node backend.js');
  expect(await shell.serialize()).toEqual({
    message: {
      method: 'setContent',
      params: { content: 'content from the backend' },
    },
  });

  if (headless) {
    // headless playwright bug where it doesnt send the event to the iframe
    await shell.page.frames()[1].evaluate(() => {
      const event = new KeyboardEvent('keydown', {
        key: 'c',
        code: 'KeyC',
        ctrlKey: true,
        bubbles: true,
      });
      document.body.dispatchEvent(event);
    });
  } else {
    await shell.page.keyboard.press('Control+C');
  }
  await new Promise(f => setTimeout(f, 200)); // catch bug where stdin was ending up in the prompt
  expect(await shell.serialize()).toEqual({
    log: [
      '> node backend.js',
      'closing',
    ],
    prompt: { value: '' }  });
});

