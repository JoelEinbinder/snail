const {execute, getAndResetChanges, setAlias} = require('./index');
const {WebSocket} = require('ws');
listenToWebSocket()

async function listenToWebSocket() {
  const webSocket = new WebSocket(process.argv[2]);
  await new Promise(x => webSocket.once('open', x));
  webSocket.send(JSON.stringify({id: parseInt(process.argv[3])}));
  while (true) {
    const {command, magicToken, changes} = JSON.parse(await new Promise(x => webSocket.once('message', x)));
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
      webSocket.send(JSON.stringify(result));
    }
  }
}
async function runCommand(command, magicToken) {
  const {stdin, closePromise, kill} = execute(command);
  const c = await closePromise;
  process.exitCode = c;
  if (magicToken) {
    const magicString = `\x33[JOELMAGIC${magicToken}]\n`;
    process.stdout.write(magicString);
  }
  return {exitCode: c, changes: getAndResetChanges()};
}
