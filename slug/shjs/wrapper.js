const {execute, getAndResetChanges, setAllAliases} = require('./index');
//@ts-ignore
const {takeControl} = require('../node-pty/build/Release/pty.node');
takeControl(process.stdout.fd);
process.stdin.pause();
process.on('message', async (/** @type {any} */ event) => {
  const {method, params} = event;
  if (method === 'fush-stdin') {

    const leftoverData = await new Promise(resolve => {
      let buffer = '';
      process.stdin.resume();
      const ondata = data => {
        buffer += data.toString();
        if (buffer.endsWith(params.stdinEndToken)) {
          resolve(buffer.substring(0, buffer.length - params.stdinEndToken.length));
          process.stdin.off('data', ondata);
          process.stdin.pause();
        }
      };
      process.stdin.on('data', ondata);
    });
    process.send(leftoverData);
  } else if (method === 'command') {
    const { command, env, dir, magicToken, aliases, noSideEffects} = params;
    process.env = env;
    try {
      process.chdir(dir);
    } catch (e) {
    }
    setAllAliases(aliases)
    getAndResetChanges();
    const result = await runCommand(command.toString(), magicToken, noSideEffects);
    process.send(result);
  } else if (method === 'kill') {
    killLastCommand(9);
  }
});

process.send('intialized');

let killLastCommand = (signal) => void 0;
async function runCommand(command, magicToken, noSideEffects) {
  const stdin = noSideEffects ? null : process.stdin;
  const { closePromise, kill} = execute(command, process.stdout, process.stderr, stdin, noSideEffects);
  killLastCommand = kill;
  const c = await closePromise;
  process.exitCode = c;
  if (magicToken) {
    const magicString = `\x1B[JOELMAGIC${magicToken}]\n`;
    process.stdout.write(magicString);
  }
  return {exitCode: c, changes: getAndResetChanges()};
}

process.on('SIGINT', () => {
  // catch sigint, but still kill the inner process
  killLastCommand(2);
});

process.on('SIGQUIT', () => {
  // catch sigquit, but still kill the inner process
  killLastCommand(3);
});