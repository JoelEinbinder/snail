import { test, expect } from './fixtures';
import os from 'os';
import fs from 'fs';
import path from 'path';

test('can run a command', async ({ shell }) => {
  await shell.runCommand('echo hello');
  expect(await shell.serialize()).toEqual({
    log: [
      '> echo hello',
      'hello'
    ],
    prompt: { value: '' }
  });
});

test('can create a file and see it in ls', async ({ shell }) => {
  await shell.runCommand('touch a.txt');
  await shell.runCommand('ls');
  expect(await shell.serialize()).toEqual({
    log: [
      '> touch a.txt',
      '> ls',
      ['a.txt'],
    ],
    prompt: { value: '' }
  });
});

test('opens autocomplete', async ({ shell }) => {
  await shell.typeInPrompt('docker ');
  expect(await shell.serialize()).toEqual({
    log: [],
    prompt: {
      value: 'docker ',
      autocomplete: [
        'attach',  'build',   'builder', 'buildx',
        'commit',  'compose', 'config',  'container',
        'context', 'cp',      'create',  'diff',
        'events',  'exec',    'export',  'extension',
        'history', 'image',   'images',  'import',
        'info',    'inspect', 'kill',    'load',
        'login',   'logout',  'logs',    'manifest',
        'network', 'node',    'pause',   'plugin',
        'port',    'ps',      'pull',    'push',
        'rename',  'restart', 'rm',      'rmi',
        'run',     'save',    'sbom',    'scan',
        'search',  'secret',  'service', 'stack',
        'start',   'stats',   'stop',    'swarm',
        'system',  'tag',     'top',     'trust',
        'unpause', 'update',  'version', 'volume',
        'wait',

        '--config',
        '--context',
        '--debug',
        '--host',
        '--log-level',
        '--tls',
        '--tlscacert',
        '--tlscert',
        '--tlskey',
        '--tlsverify',
        '--version',
      ]
    }
  })
});

test('sees aliases in autocomplete', async ({ shell }) => {
  await shell.runCommand('alias my_alias_for_test ls');
  await shell.typeInPrompt('my_alias');
  expect((await shell.serialize()).prompt.autocomplete).toEqual(['my_alias_for_test']);
});

test('has only directories in cd autocomplete', async ({ shell, workingDir }) => {
  await shell.runCommand(`cd ${workingDir}; mkdir a b c; touch d e f; mkdir a/sub_a`);
  await shell.typeInPrompt('cd ');
  expect((await shell.serialize()).prompt.autocomplete).toEqual(['', 'a', 'b', 'c', '.']);
  await shell.typeInPrompt('a/');
  expect((await shell.serialize()).prompt.autocomplete).toEqual(['', 'sub_a']);
});

test('sees filter autocomplete properly', async ({ shell }) => {
  await shell.runCommand('export FOO_BAR=123; export FOO_BAZ=456; export NOT_THIS=789;');
  await shell.typeInPrompt('echo $FOO_');
  expect((await shell.serialize()).prompt.autocomplete).toEqual(['$FOO_BAR', '$FOO_BAZ']);
});

test('find the right anchor if the predicate contains a copy of the prefix', async ({ shell }) => {
  await shell.runCommand('const r = { hello: 1, world: 2, __proto__: null };');
  await shell.typeInPrompt('r.wor');
  expect((await shell.serialize()).prompt.autocomplete).toEqual(['world']);
});

test('log a js object', async ({ shell }) => {
  await shell.runCommand('{ abc: 123, def: 456 }');
  expect((await shell.serialize())).toEqual({
    log: [
      '> { abc: 123, def: 456 }',
      '{ abc: 123, def: 456 }',
    ],
    prompt: { value: '' }
  });
  // expand the object
  await shell.page.click('details');
  await shell.waitForAsyncWorkToFinish();
  expect((await shell.serialize())).toEqual({
    log: [
      '> { abc: 123, def: 456 }',
      ['{',
      'abc: 123',
      'def: 456',
      '[[Prototype]]: [Object]',
      '}'].join('\n'),
    ],
    prompt: { value: '' }
  });
});


test('can regular ssh into docker', async ({ shell, docker }) => {
  shell.waitForLine(/password: /).then(async () => {
    await shell.page.keyboard.type('mypassword');
    await shell.page.keyboard.press('Enter');  
  });
  // ConnectionAttempts because sshd really doesnt start up when it says it starts up
  await shell.runCommand(`ssh -o ConnectionAttempts=10 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o LogLevel=ERROR ${docker.address} -p ${docker.port} echo done`);
  expect(await shell.serialize()).toEqual({
    log: [
      `> ssh -o ConnectionAttempts=10 -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o LogLevel=ERROR ${docker.address} -p ${docker.port} echo done`,
      `${docker.address}'s password: \ndone`
    ],
    prompt: { value: '' }
  });
});

test('can ssh2 into docker', async ({ shellInDocker }) => {
  await shellInDocker.runCommand('whoami');
  await shellInDocker.runCommand('exit');
  await shellInDocker.runCommand('whoami');

  expect(await shellInDocker.serialize()).toEqual({
    log: [
      '> whoami',
      'snailuser',
      '> exit',
      '> whoami',
      os.userInfo().username,
    ],
    prompt: { value: '' }
  });
});

test('startup', async ({ shell }) => {
  expect(await shell.serialize()).toEqual({
    log: [],
    prompt: { value: '' },
  });
});

test('daemon mode toggle', async ({ shell }) => {
  await shell.toggleDemonMode();
  expect(await shell.page.title()).toMatch(/😈$/);
  await shell.toggleDemonMode();
  expect(await shell.page.title()).not.toMatch(/😈$/);
});

test('can have two tabs', async ({ shellFactory }) => {
  const shell1 = await shellFactory();
  const shell2 = await shellFactory();
  await shell1.runCommand('echo hello');
  await shell2.runCommand('echo world');
  expect(await shell1.serialize()).toEqual({
    log: [ '> echo hello', 'hello' ],
    prompt: { value: '' },
  });
  expect(await shell2.serialize()).toEqual({
    log: [ '> echo world', 'world' ],
    prompt: { value: '' },
  });
});

test('can reconnect', async ({ shellFactory }) => {
  const shell1 = await shellFactory();
  await shell1.runCommand('let foo = 456');
  await shell1.toggleDemonMode();
  // read binary doesn't exist on arch so use bash builtin 
  shell1.runCommand('bash -c \'read -p "Yes or no?" yn\'').catch(e => {});
  await shell1.waitForLine(/Yes or no\?/);
  await shell1.close();

  const shell2 = await shellFactory();
  const reconnect = shell2.runCommand('reconnect');
  await shell2.waitForLine(/Yes or no\?/);
  await shell2.page.keyboard.type('y');
  await shell2.page.keyboard.press('Enter');
  await reconnect;
  await shell2.runCommand('console.log(foo)');
  const serialized = await shell2.serialize();
  serialized.log[1][0].socketPath = '<redacted>';
  serialized.log[1][0].task.started = '<redacted>'
  expect(serialized).toEqual({
    log: [
      '> reconnect --list',
      [{
        connected: false,
        socketPath: '<redacted>',
        task: {
          command: 'bash -c \'read -p "Yes or no?" yn\'',
          started: '<redacted>',
        },
      }],
      '> reconnect',
      'Yes or no?y',
      '> console.log(foo)',
      '456',
      'undefined',
    ],
    prompt: {
      value: '',
    },
  });
  await shell2.runCommand('exit');
  const shell3 = await shellFactory();
  expect(await shell3.serialize()).toEqual({ log: [], prompt: { value: '' } })
});

test('stdin doesnt leak to the next command', async ({ shell }) => {
  // https://github.com/xxorax/node-shell-escape MIT
  function shellescape(s) {
    if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
      s = "'"+s.replace(/'/g,"'\\''")+"'";
      s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
        .replace(/\\'''/g, "\\'" ); // remove non-escaped single-quote if there are enclosed between 2 escaped
    }
    return s;
  }    
  
  // put some stuff into stdin that nobody wants to read
  const firstCommandPromise = shell.runCommand('echo Command Running && sleep 3;');
  await shell.waitForLine(/Command Running/);
  await shell.page.keyboard.type('abcdefghijklmnopqrstuvwxy');
  await firstCommandPromise;
  // the unread stdin text should appear in the prompt
  expect((await shell.serialize()).prompt.value).toEqual('abcdefghijklmnopqrstuvwxy');
  // make sure that the next command does not read it
  function innerCommand() {
    const received: Buffer[] = [];
    process.stdin.on('data', data => {
      received.push(data);
      if (data.toString().includes('z')) {
        console.log('recieved', Buffer.concat(received).toString());
        process.exit(0);
      }
    });
    process.stdin.setRawMode(true);
    console.log('I am listening!');
  }
  const secondCommandPromise = shell.runCommand(`node -e ${shellescape(`(${innerCommand.toString()})()`)}`);
  await shell.waitForLine(/I am listening!/);
  await shell.page.keyboard.type('z');
  await secondCommandPromise;
  const serailized = await shell.serialize();
  expect(serailized.log[3]).toEqual(
    'I am listening!\n' +
    'recieved z'
  );
});

test('can clear', async ({ shell }) => {
  await shell.runCommand('echo clear this');
  await shell.runCommand('clear');
  expect(await shell.serialize()).toEqual({
    log: [
    ],
    prompt: {
      value: '',
    },
  });
});

test('can clear and still show rest of terminal output', async ({ shell }) => {
  await shell.runCommand('echo clear this');
  await shell.runCommand('clear && echo hello');
  expect(await shell.serialize()).toEqual({
    log: [
      '> clear && echo hello', // the command parent must exist, so this doesn't get cleared
      'hello',
    ],
    prompt: {
      value: '',
    },
  });
});

test('can clear and still show rest of terminal output, separate statements', async ({ shell }) => {
  await shell.runCommand('echo clear this');
  await shell.runCommand('clear; echo hello');
  expect(await shell.serialize()).toEqual({
    log: [
      '> clear; echo hello', // the active command block is retained, so this doesn't get cleared
      'hello',
    ],
    prompt: {
      value: '',
    },
  });
});

test('can clear with keyboard shortcut', async ({ shell }) => {
  await shell.runCommand('echo clear this');
  await shell.page.keyboard.press('Control+KeyL');
  expect(await shell.serialize()).toEqual({
    log: [
    ],
    prompt: {
      value: '',
    },
  });
});

test('should report uncaught node errors', async ({ shell }) => {
  await shell.runCommand(`const socket = net.connect({ path: './not-a-real-path.txt' });`);
  await shell.runCommand('echo still alive');
  const serialized = await shell.serialize();
  serialized.log = serialized.log.map(x => x.replace(/^\s*at .*$/gm, '<readacted>'))
  expect(serialized).toEqual({
    log:[
      "> const socket = net.connect({ path: './not-a-real-path.txt' });",
      "Error: connect ENOENT ./not-a-real-path.txt\n" +
      "<readacted>",
      "undefined",
      "> echo still alive",
      "still alive",
    ],
    prompt: {
      value: '',
    },
  });
});

test('split', async ({ shell }) => {
  await shell.runCommand('echo hello');
  const [left, right] = await shell.splitHorizontally();
  await right.runCommand('echo goodbye');
  expect(await shell.serialize()).toEqual({
    type: 'split-horizontal',
    ratio: 0.5,
    children: [{
      log: [
        '> echo hello',
        'hello'
      ],
      prompt: { value: '' },
    }, {
      log: [
        '> echo goodbye',
        'goodbye'
      ],
      prompt: { value: '' },
    }],
  });
});

test('clicking below the prompt should focus prompt', async ({ shell }) => {
  await shell.page.mouse.click(100, 100);
  await shell.page.keyboard.type('echo can you see this?');
  expect((await shell.serialize()).prompt.value).toEqual('echo can you see this?');
});

test.skip('should be able to switch tabs wtih cmd+number', async({ shellFactory }) => {
  // This kind of works, but electron lacks the ability to find out the current tab order
  // or the tab groupings. So it just switches between all tabs in creation order. Should fix.
  // Also should only show things in the command menu if there is a corresponding tab.
  const shell1 = await shellFactory();
  const shell2 = await shellFactory();
});

test('opening a new tab should have the same working directory', async ({ shellFactory }) => {
  const shell1 = await shellFactory();
  await shell1.runCommand('cd /');
  const shell2 = await shellFactory();
  await shell2.runCommand('pwd');
  expect(await shell2.serialize()).toEqual({
    log: [
      '> pwd',
      '/',
    ],
    prompt: { value: '' },
  });
});

test('aliases', async ({ shell }) => {
  await shell.runCommand('alias abc echo hello; alias def echo world');
  await shell.runCommand('abc');
  await shell.runCommand('def');
  expect(await shell.serialize()).toEqual({
    log: [
      '> alias abc echo hello; alias def echo world',
      '> abc',
      'hello',
      '> def',
      'world',
    ],
    prompt: { value: '' },
  });
});


test('aliases should still work even if shell was killed', async ({ shell }) => {
  await shell.runCommand('alias abc echo hello');
  const commandPromise = shell.runCommand('echo set; sleep 10');
  await shell.waitForLine(/set/);
  await shell.page.keyboard.press('Control+C');
  await commandPromise;
  await shell.runCommand('abc');
  expect(await shell.serialize()).toEqual({
    log: [
      '> alias abc echo hello',
      '> echo set; sleep 10',
      'set',
      '^C',
      '> abc',
      'hello',
    ],
    prompt: { value: '' },
  });
});

test('should not flicker with blank lines in terminal blocks', async ({ shell, workingDir }) => {
  await fs.promises.writeFile(path.join(workingDir, 'flicker.js'), `(async function () {
      console.log('first line');
      process.stdin.setRawMode(true);
      process.stdout.write('second line');
      await new Promise(x => process.stdin.once('data', x));
      process.stdout.write('\\r\\x1b[2K\\x1b[1A\\x1b[2Knew line');
      await new Promise(x => process.stdin.once('data', x));
      process.exit();
  })();`);
  const commandPromise = shell.runCommand('node flicker.js');
  await shell.waitForLine(/second line/);
  expect((await shell.serialize()).log[1]).toBe('first line\nsecond line');
  await shell.page.keyboard.press('Enter');
  await shell.waitForLine(/new line/);
  expect((await shell.serialize()).log[1]).toBe('new line\n');
  await shell.page.keyboard.press('Enter');
  await commandPromise;
  expect((await shell.serialize()).log[1]).toBe('new line');
});

test('should consume blank lines in terminal blocks', async ({ shell, workingDir }) => {
  await fs.promises.writeFile(path.join(workingDir, 'grow.js'), `(async function () {
      console.log('first line');
      process.stdin.setRawMode(true);
      await new Promise(x => process.stdin.once('data', x));
      process.exit();
  })();`);
  const commandPromise = shell.runCommand('node grow.js');
  await shell.waitForLine(/first line/);
  expect((await shell.serialize()).log[1]).toBe('first line\n');
  const viewport = {
    width: 490,
    height: 371,
  };
  await shell.page.setViewportSize({width: viewport.width, height: viewport.height + 19 * 3});
  expect((await shell.serialize()).log[1]).toBe('first line\n');
  await shell.page.keyboard.press('Enter');
  await commandPromise;
  expect((await shell.serialize()).log[1]).toBe('first line');
});

test('should consume blank lines in terminal blocks after a lot of data', async ({ shell, workingDir }) => {
  await fs.promises.writeFile(path.join(workingDir, 'grow.js'), `(async function () {
      for (let i = 0; i < 100; i++)
          console.log(i);
      console.log('first line');
      process.stdin.setRawMode(true);
      await new Promise(x => process.stdin.once('data', x));
      process.exit();
  })();`);
  let prefix = '';
  for (let i = 0; i < 100; i++)
      prefix += String(i) + '\n';
  const commandPromise = shell.runCommand('node grow.js');
  await shell.waitForLine(/first line/);
  expect((await shell.serialize()).log[1]).toBe(prefix + 'first line\n');
  const viewport = {
    width: 490,
    height: 371,
  };
  await shell.page.setViewportSize({width: viewport.width, height: viewport.height + 19 * 3});
  expect((await shell.serialize()).log[1]).toBe(prefix + 'first line\n');
  await shell.page.keyboard.press('Enter');
  await commandPromise;
  expect((await shell.serialize()).log[1]).toBe(prefix + 'first line');
});
