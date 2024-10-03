import path from 'path';
import { test, expect } from './fixtures';
import { execSync } from 'child_process';

test('should execute with bash', async ({ shell }) => {
  await shell.setLanguage('bash');
  await shell.runCommand('if [ -z "$BASH_VERSION" ]; then echo "no bash"; else echo "bash"; fi');
  expect(await shell.serialize()).toEqual({
    log: [
      '> if [ -z "$BASH_VERSION" ]; then echo "no bash"; else echo "bash"; fi',
      'bash'
    ],
    prompt: { value: '' }
  });
});
test('should execute with python', async ({ shell }) => {
  await shell.setLanguage('python');
  await shell.runCommand('print("python")');
  expect(await shell.serialize()).toEqual({
    log: [
      '> print("python")',
      'python',
      'None'
    ],
    prompt: { value: '' }
  });
});
test('should change directory with bash', async ({ shell }) => {
  await shell.setLanguage('bash');
  await shell.runCommand('mkdir foo; cd foo; clear');
  await shell.runCommand('basename $(pwd)');
  expect(await shell.serialize()).toEqual({
    log: [
      '> basename $(pwd)',
      'foo',
    ],
    prompt: { value: '' }
  });
});
test('should follow directory changes in python', async ({ shell, workingDir }) => {
  await shell.setLanguage('python');
  await shell.runCommand('import os');

  await shell.setLanguage('shjs');
  await shell.runCommand('clear');

  await shell.setLanguage('python');
  await shell.runCommand('os.getcwd()');

  await shell.setLanguage('shjs');
  await shell.runCommand('mkdir foo; cd foo;');

  await shell.setLanguage('python');
  await shell.runCommand('os.getcwd()');

  expect(await shell.serialize()).toEqual({
    log: [
      '> os.getcwd()',
      `'${workingDir}'`,
      '> mkdir foo; cd foo;',
      '> os.getcwd()',
      `'${workingDir}/foo'`,
    ],
    prompt: { value: '' }
  });
});
test('should follow env changes in python', async ({ shell, workingDir }) => {
  await shell.setLanguage('python');
  await shell.runCommand('import os');

  await shell.setLanguage('shjs');
  await shell.runCommand('clear');

  await shell.setLanguage('python');
  await shell.runCommand('os.getenv("FOO")');

  await shell.setLanguage('shjs');
  await shell.runCommand('export FOO=bar');

  await shell.setLanguage('python');
  await shell.runCommand('os.getenv("FOO")');

  expect(await shell.serialize()).toEqual({
    log: [
      '> os.getenv("FOO")',
      'None',
      '> export FOO=bar',
      '> os.getenv("FOO")',
      "'bar'",
    ],
    prompt: { value: '' }
  });
});
test('should follow venvs', async ({ shell, workingDir }) => {
  await shell.setLanguage('python');
  await shell.runCommand('import sys');
  await shell.runCommand('sys.executable');

  await shell.setLanguage('shjs');
  await shell.runCommand('python3 -m venv .venv; source .venv/bin/activate');

  await shell.setLanguage('python');
  await shell.runCommand('import sys');
  await shell.runCommand('sys.executable');

  expect(await shell.serialize()).toEqual({
    log: [
      '> import sys',
      '> sys.executable',
      `'${execSync('python3 -c "import sys; print(sys.executable)"').toString().trim()}'`,
      '> python3 -m venv .venv; source .venv/bin/activate',
      '> import sys',
      '> sys.executable',
      `'${path.join(workingDir, '.venv', 'bin', 'python3')}'`,
    ],
    prompt: { value: '' }
  });
});
test('should remember language choice', async ({ shellFactory }) => {
  const shell1 = await shellFactory();
  await shell1.setLanguage('python');
  await shell1.close();

  const shell2 = await shellFactory();
  await shell2.runCommand('print("i am python")');
  expect(await shell2.serialize()).toEqual({
    log: [
      '> print("i am python")',
      'i am python',
      'None'
    ],
    prompt: { value: '' }
  });
});
test('should use the correct language for history', async ({ shell }) => {
  await shell.setLanguage('python');
  await shell.runCommand('print("python")');
  await shell.setLanguage('bash');
  await shell.runCommand('echo bash');
  await shell.setLanguage('shjs');
  await shell.runCommand('echo shjs');
  await shell.setLanguage('javascript');
  await shell.runCommand('console.log("javascript")');
  expect(await shell.serialize()).toEqual({
    log: [
      '> print("python")',
      'python',
      'None',
      '> echo bash',
      'bash',
      '> echo shjs',
      'shjs',
      '> console.log("javascript")',
      'javascript',
      'undefined'
    ],
    prompt: { value: '' }
  });
  await shell.setLanguage('shjs');
  await shell.runCommand('clear');

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      await shell.historyUp();
    }
    await shell.runPretypedCommand();
  }

  expect(await shell.serialize()).toEqual({
    log: [
      '> print("python")',
      'python',
      'None',
      '> echo bash',
      'bash',
      '> echo shjs',
      'shjs',
      '> console.log("javascript")',
      'javascript',
      'undefined'
    ],
    prompt: { value: '' }
  });
});

