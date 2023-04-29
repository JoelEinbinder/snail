import { test, expect } from './fixtures';
import os from 'os';

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
  expect(await shell2.serialize()).toEqual({
    log: [
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
