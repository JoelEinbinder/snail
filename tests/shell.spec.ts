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

test('ssh2 delete this test', async ({ shell }) => {
  await shell.runCommand('ssh2 joeleinbinder@localhost');
  expect(await shell.serialize()).toEqual({
    log: [ '> ssh2 joeleinbinder@localhost' ],
    prompt: { value: '' }
  });
  await shell.runCommand('whoami && pwd');
  expect(await shell.serialize()).toEqual({
    log: [
      '> ssh2 joeleinbinder@localhost',
      '> whoami && pwd',
      'joeleinbinder\n/Users/joeleinbinder'
    ],
    prompt: { value: '' }
  });
  await shell.runCommand(`cd /Users/joeleinbinder/gap-year/tests/docker/; ls`);
  expect(await shell.serialize()).toEqual({
    log: [
      '> ssh2 joeleinbinder@localhost',
      '> whoami && pwd',
      'joeleinbinder\n/Users/joeleinbinder',
      '> cd /Users/joeleinbinder/gap-year/tests/docker/; ls',
      [ 'Dockerfile' ],
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
  shell1.runCommand('read -p "Yes or no?" yn').catch(e => {});
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
});
