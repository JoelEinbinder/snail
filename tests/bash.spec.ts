import { test, expect } from './fixtures';

test('should change dirs with bash-eval', async ({ shell, workingDir }) => {
  await shell.runCommand('bash-eval "mkdir foo; cd foo"')
  await shell.runCommand('process.cwd()');
  expect(await shell.serialize()).toEqual({
    log: [
      '> bash-eval "mkdir foo; cd foo"',
      '> process.cwd()',
      `'${workingDir}/foo'`
    ],
    prompt: { value: '' }
  });
});

test('should change env with bash-eval', async ({ shell }) => {
  await shell.runCommand('bash-eval "export FOO=bar"')
  await shell.runCommand('echo $FOO');
  expect(await shell.serialize()).toEqual({
    log: [
      '> bash-eval "export FOO=bar"',
      '> echo $FOO',
      'bar'
    ],
    prompt: { value: '' }
  });
});

test('should accept input with bash-eval', async ({ shell }) => {
  const evalPromise = shell.runCommand('bash-eval "read -p \'hello \'; export REPLY"');
  
  await shell.waitForLine(/hello/);
  await shell.page.keyboard.type('this is me\n');

  await evalPromise;
  await shell.runCommand('echo $REPLY');
  expect(await shell.serialize()).toEqual({
    log: [
      '> bash-eval "read -p \'hello \'; export REPLY"',
      'hello this is me',
      '> echo $REPLY',
      'this is me'
    ],
    prompt: { value: '' }
  });
});

test('should set aliases with bash-eval', async ({ shell }) => {
  await shell.runCommand('bash-eval \'alias foo="echo i am foo"\'')
  await shell.runCommand('bash-eval "foo"');
  expect(await shell.serialize()).toEqual({
    log: [
      '> bash-eval \'alias foo="echo i am foo"\'',
      '> bash-eval "foo"',
      'i am foo'
    ],
    prompt: { value: '' }
  });
});

test('should allow functions with bash-eval', async ({ shell }) => {
  await shell.runCommand('bash-eval "my_fn() { echo i am a function; };"');
  await shell.runCommand('bash-eval "my_fn"');
  expect(await shell.serialize()).toEqual({
    log: [
      '> bash-eval "my_fn() { echo i am a function; };"',
      '> bash-eval "my_fn"',
      'i am a function'
    ],
    prompt: { value: '' }
  });
});

test('should allow bash functions outside of bash-eval', async ({ shell }) => {
  await shell.runCommand('bash-eval "my_fn() { echo i am a function; }; alias my_alias=\'echo i am an alias\'"');
  await shell.runCommand('my_fn');
  await shell.runCommand('my_alias');
  expect(await shell.serialize()).toEqual({
    log: [
      '> bash-eval "my_fn() { echo i am a function; }; alias my_alias=\'echo i am an alias\'"',
      '> my_fn',
      'i am a function',
      '> my_alias',
      'i am an alias',
    ],
    prompt: { value: '' }
  });
});

test('should accept arguments to bash functions', async ({ shell }) => {
  await shell.runCommand(`bash-eval 'my_fn() { echo $@; }'`);
  await shell.runCommand('my_fn hello world');
  expect(await shell.serialize()).toEqual({
    log: [
      `> bash-eval 'my_fn() { echo $@; }'`,
      '> my_fn hello world',
      'hello world'
    ],
    prompt: { value: '' }
  });
});

test('bash functions should appear in autocomplete', async ({ shell }) => {
  await shell.runCommand('bash-eval "my_fn() { echo i am a function; }; alias my_alias=\'echo i am an alias\'"');
  await shell.typeInPrompt('my_');
  await shell.waitForAsyncWorkToFinish();
  expect((await shell.serialize()).prompt).toEqual({ value: 'my_', autocomplete: ['my_alias', 'my_fn'] });
});

test('should be able to remove an environment variable', async({ shell }) => {
  await shell.runCommand('export FOO=bar');
  await shell.runCommand('bash-eval "unset FOO"');
  await shell.runCommand('("FOO" in process.env)');
  expect(await shell.serialize()).toEqual({
    log: [
      '> export FOO=bar',
      '> bash-eval "unset FOO"',
      '> ("FOO" in process.env)',
      'false'
    ],
    prompt: { value: '' }
  });
});
