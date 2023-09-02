const {execute, getAndResetChanges, setAllAliases} = require('./index');
const net = require('net');
const {PipeTransport} = require('../protocol/pipeTransport');
const [socketPath, uuid, idStr] = process.argv.slice(2);
listenToWebSocket()

async function listenToWebSocket() {
  const socket = net.createConnection({path: socketPath});
  const transport = new PipeTransport(socket, socket);
  await new Promise(x => socket.once('connect', x));
  transport.sendString(JSON.stringify({id: parseInt(idStr), uuid}));
  while (true) {
    const {method, params} = await new Promise(x => transport.onmessage = x);
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
      transport.sendString(JSON.stringify(leftoverData));
    } else if (method === 'command') {
      const { command, env, dir, magicToken, aliases } = params;
      process.env = env;
      try {
        process.chdir(dir);
      } catch (e) {
      }
      setAllAliases(aliases)
      getAndResetChanges();
      const result = await runCommand(command.toString(), magicToken);
      transport.sendString(JSON.stringify(result));
    }
  }
}
async function runCommand(command, magicToken) {
  process.stdin.setRawMode(false);
  const {stdin, closePromise, kill} = execute(command);
  const c = await closePromise;
  process.stdin.setRawMode(true);
  process.exitCode = c;
  if (magicToken) {
    const magicString = `\x1B[JOELMAGIC${magicToken}]\n`;
    process.stdout.write(magicString);
  }
  return {exitCode: c, changes: getAndResetChanges()};
}
