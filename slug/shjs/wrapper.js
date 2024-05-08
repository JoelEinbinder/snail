const {execute, getAndResetChanges, setAllAliases} = require('./index');
//@ts-ignore
const {takeControl} = require('../node-pty/build/Release/pty.node');
takeControl(process.stdout.fd);
process.on('message', async (/** @type {any} */ event) => {
  const {method, params} = event;
  if (method === 'fush-stdin') {
    
    const leftoverData = await new Promise(resolve => {
      let buffer = '';
      const ondata = data => {
        buffer += data.toString();
        if (buffer.endsWith(params.stdinEndToken)) {
          resolve(buffer.substring(0, buffer.length - params.stdinEndToken.length));
          process.stdin.off('data', ondata);
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
  }
});

process.send('intialized');

async function runCommand(command, magicToken, noSideEffects) {
  const {stdin, closePromise, kill} = execute(command, process.stdout, process.stderr, process.stdin, noSideEffects);
  const c = await closePromise;
  process.exitCode = c;
  if (magicToken) {
    const magicString = `\x1B[JOELMAGIC${magicToken}]\n`;
    process.stdout.write(magicString);
  }
  return {exitCode: c, changes: getAndResetChanges()};
}
