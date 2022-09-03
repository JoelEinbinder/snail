const {execute, getAndResetChanges, setAlias} = require('./index');
const net = require('net');
const {PipeTransport} = require('../protocol/pipeTransport');
const [socketPath, uuid, idStr, aliasesStr] = process.argv.slice(2);
const aliases = JSON.parse(aliasesStr);
for (const key in aliases)
  setAlias(key, aliases[key]);
listenToWebSocket()

async function listenToWebSocket() {
  const socket = net.createConnection({path: socketPath});
  const transport = new PipeTransport(socket, socket);
  await new Promise(x => socket.once('connect', x));
  transport.sendString(JSON.stringify({id: parseInt(idStr), uuid}));
  while (true) {
    const {command, magicToken, changes} = await new Promise(x => transport.onmessage = x);
    if (changes) {
      if (changes.cwd)
        process.chdir(changes.cwd);
      if (changes.env) {
        for (const key in changes.env)
          process.env[key] = changes.env[key];
      }
      if (changes.aliases) {
        for (const key of Object.keys(changes.aliases))
          setAlias(key, changes.aliases[key]);
      }
      getAndResetChanges();
    } else if (command) {
      const result = await runCommand(command.toString(), magicToken);
      transport.sendString(JSON.stringify(result));
    }
  }
}
async function runCommand(command, magicToken) {
  const {stdin, closePromise, kill} = execute(command);
  const c = await closePromise;
  process.exitCode = c;
  if (magicToken) {
    const magicString = `\x1B[JOELMAGIC${magicToken}]\n`;
    process.stdout.write(magicString);
  }
  return {exitCode: c, changes: getAndResetChanges()};
}
