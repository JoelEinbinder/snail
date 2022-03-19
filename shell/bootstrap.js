process.stdin.on('data', () => void 0);
process.stdin.on('end', () => {
  process.exit();
});
const getPort = require('get-port');
getPort().then(port => {
  require('inspector').open(port, undefined, false);
});
/**
 * @typedef {{
 * env?: {[key: string]: string},
 * aliases?: {[key: string]: string[]},
 * cwd?: string,
 * nod?: string[],
 * ssh?: string,
 * exit?: number,
 * }} Changes
 */
/** @type {Map<number, (s: WebSocket) => void} */
const resolveShellConnection = new Map();

global.bootstrap = (args) => {
  const binding = global.magic_binding;
  delete global.magic_binding;
  delete global.bootstrap;
  const {sh} = require('../shjs/jsapi');
  global.sh = sh;
  function notify(method, params) {
    binding(JSON.stringify({method, params}));
  }
  /** @type {Map<number, import('node-pty').IPty>} */
  const shells = new Map();
  let shellId = 0;
  let rows = 24;
  let cols = 80;
  /** @type {{shell: import('node-pty').IPty, connection: WebSocket}} */
  let freeShell = null;
  global.pty = async function(command) {
    const magicToken = String(Math.random());
    const magicString = `\x33[JOELMAGIC${magicToken}]\r\n`;
    let env = {...process.env};
    let cwd = process.cwd();
    const id = ++shellId;
    const url = await getServerUrl();
    /** @type {Promise<WebSocket>|WebSocket} */
    const conncectionPromise = freeShell ? freeShell.connection : new Promise(x => resolveShellConnection.set(id, x));
    const shell = freeShell ? freeShell.shell : require('node-pty').spawn(process.execPath, [require('path').join(__dirname, '..', 'shjs', 'wrapper.js'), url, id], {
      env,
      rows,
      cols,
      cwd,
      name: 'xterm-256color',
      handleFlowControl: true,
      encoding: null,
    });
    freeShell = null;
    const connection = await conncectionPromise;
    connection.send(JSON.stringify({command, magicToken}));
    const connectionDonePromise = new Promise(x => {
      connection.once('message', data => {
        x(JSON.parse(data));
      });
    });
    notify('startTerminal', {id});
    shells.set(id, shell);
    let waitForDoneCallback;
    const waitForDonePromise = new Promise(x => waitForDoneCallback = x);
    let last = '';
    const disposeDataListener = shell.onData(d => {
      let data = d.toString();
      if ((last + data).slice(last.length + data.length - magicString.length).toString() === magicString) {
        data = data.slice(0, -magicString.length);
        if (data)
          notify('data', {id, data});
        waitForDoneCallback();
        return;
      }
      last = (last + data).slice(-magicString.length);
      notify('data', {id, data});
    });
    /** @type {{exitCode: number, died?: boolean, signal?: number, changes?: Changes}} */
    const returnValue = await Promise.race([
      new Promise(x => shell.onExit(value => {x({...value, died: true}); waitForDoneCallback()})),
      connectionDonePromise,
    ]);
    await waitForDonePromise;
    shells.delete(id);
    if (freeShell) {
      if (!returnValue.died)
        shell.kill();
      if (changes)
        freeShell.connection.send(JSON.stringify({changes}));
    } else if (!returnValue.died) {
      disposeDataListener.dispose();
      freeShell = {connection, shell}
    }
    if (returnValue.changes) {
      const changes = returnValue.changes;
      if (changes.cwd) {
        cwd = changes.cwd;
        process.chdir(cwd);
        notify('cwd', changes.cwd);
      }
      if (changes.env) {
        for (const key in changes.env) {
          env[key] = changes.env[key];
          process.env[key] = changes.env[key];
        }
        notify('env', changes.env);
      }
      if (changes.aliases) {
        const {setAlias} = require('../shjs/index');
        notify('aliases', changes.aliases);
        for (const key of Object.keys(changes.aliases)) {
          setAlias(key, changes.aliases[key]);
        }
      }
      if (changes.nod)
        notify('nod', changes.nod);
      if (changes.ssh)
        notify('ssh', changes.ssh);
      if (changes.exit !== undefined) {
        process.exit(changes.exit);
      }
    }
    notify('endTerminal', {id, returnValue});
    return 'this is the secret secret string';
  }
  const handler = {
    input({id, data}) {
      if (!shells.has(id))
        return;
      shells.get(id).write(data);
    },
    resize(size) {
      rows = size.rows;
      cols = size.cols;
      for (const shell of shells.values())
        shell.resize(size.cols, size.rows);
    }
  }
  return function respond(data) {
    const {method, params} = data;
    handler[method](params);
  }
};

let serverPromise = null;
async function getServerUrl() {
  if (!serverPromise)
    serverPromise = launchServer();
  return serverPromise;
}

async function launchServer() {
  const {Server} = require('ws');
  const getPort = require('get-port');
  const port = await getPort();
  const uuid = require('crypto').randomUUID();
  const server = new Server({port, path: '/' + uuid});
  await new Promise(x => server.on('listening', x));
  server.on('connection', async connection => {
    /** @type {WebSocket.RawData} */
    const message = await new Promise(x => connection.once('message', x));
    const {id} = JSON.parse(message);
    resolveShellConnection.get(id)(connection);
    resolveShellConnection.delete(id);
  });
  return 'ws://localhost:' + port + '/' + uuid;
}
