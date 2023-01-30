import { test, expect } from './fixtures';

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