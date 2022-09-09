//@ts-check
const worker_threads = require('node:worker_threads');
const worker = new worker_threads.Worker(require.resolve('./bootstrapWorker'));

worker.on('exit', code => {
  process.exit(code);
});
/**
 * @typedef {{
 * env?: {[key: string]: string},
 * aliases?: {[key: string]: string[]},
 * cwd?: string,
 * nod?: string[],
 * ssh?: string,
 * reconnect?: string,
 * code?: string,
 * exit?: number,
 * }} Changes
 */
/** @type {Map<number, (s: import('../protocol/pipeTransport').PipeTransport) => void} */
const resolveShellConnection = new Map();

global.bootstrap = (args) => {
  const binding = global.magic_binding;
  delete global.magic_binding;
  delete global.bootstrap;
  const {sh} = require('../shjs/jsapi');
  const {setAlias, getAliases} = require('../shjs/index');
  global.sh = sh;
  function notify(method, params) {
    binding(JSON.stringify({method, params}));
  }
  /** @type {Map<number, import('node-pty').IPty>} */
  const shells = new Map();
  let shellId = 0;
  let rows = 24;
  let cols = 80;
  /** @type {Promise<{shell: import('node-pty').IPty, connection: import('../protocol/pipeTransport').PipeTransport}>|null} */
  let freeShell = null;
  function ensureFreeShell() {
    if (freeShell)
      return freeShell;
    return freeShell = new Promise(async resolve => {
      const id = ++shellId;
      const {socketPath, uuid} = await getServerUrl();
      /** @type {Promise<import('../protocol/pipeTransport').PipeTransport>|import('../protocol/pipeTransport').PipeTransport} */
      const connectionPromise = new Promise(x => resolveShellConnection.set(id, x));
      const shell = require('node-pty').spawn(process.execPath, [require('path').join(__dirname, '..', 'shjs', 'wrapper.js'), socketPath, uuid, id, getAliases()], {
        env: process.env,
        rows,
        cols,
        cwd: process.cwd(),
        name: 'xterm-256color',
        handleFlowControl: true,
        encoding: null,
      });
      const connection = await connectionPromise;
      resolve({shell, connection });
    });
  }
  
  const origChangeDir = process.chdir;

  process.chdir = function(path) {
    const before = process.cwd();
    const returnValue = origChangeDir.apply(this, arguments);
    const after = process.cwd();
    if (before !== after) {
      if (freeShell)
        freeShell.then(x => x.connection.sendString(JSON.stringify({changes: {cwd: after}})));
      notify('cwd', after);
    }

    return returnValue;
  }

  function claimFreeShell() {
    const myshell = ensureFreeShell();
    freeShell = null;
    return myshell;
  }

  global.pty = async function(command) {
    const magicToken = String(Math.random());
    const magicString = `\x1B[JOELMAGIC${magicToken}]\r\n`;
    const {shell, connection} = await claimFreeShell();
    
    const connectionDonePromise = new Promise(x => {
      connection.onmessage = data => {
        delete connection.onmessage;
        x(data);
      };
    });
    connection.sendString(JSON.stringify({command, magicToken}));
    const id = ++shellId;
    notify('startTerminal', {id});
    shells.set(id, shell);
    let waitForDoneCallback;
    const waitForDonePromise = new Promise(x => waitForDoneCallback = x);
    let last = '';
    const disposeDataListener = shell.onData(d => {
      let data = last + d.toString();
      if (data.slice(data.length - magicString.length).toString() === magicString) {
        data = data.slice(0, -magicString.length);
        if (data) {
          notify('data', {id, data});
          last = '';
        }
        waitForDoneCallback();
        return;
      }
      const magicMaybeStart = data.lastIndexOf(magicString[0]);
      if (magicMaybeStart !== -1 && magicString.startsWith(data.slice(magicMaybeStart))) {
        last = data.slice(magicMaybeStart);
        data = data.slice(0, magicMaybeStart);
      } else {
        last = '';
      }
      if (data)
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
      if (returnValue.changes)
        freeShell.then(x => x.connection.sendString(JSON.stringify({changes: returnValue.changes})));
    } else if (!returnValue.died) {
      disposeDataListener.dispose();
      freeShell = Promise.resolve({connection, shell});
    }
    if (returnValue.changes) {
      const changes = returnValue.changes;
      if (changes.cwd) {
        origChangeDir(changes.cwd);
        notify('cwd', changes.cwd);
      }
      if (changes.env) {
        for (const key in changes.env) {
          process.env[key] = changes.env[key];
        }
        notify('env', changes.env);
      }
      if (changes.aliases) {
        notify('aliases', changes.aliases);
        for (const key of Object.keys(changes.aliases)) {
          setAlias(key, changes.aliases[key]);
        }
      }
      if (changes.nod)
        notify('nod', changes.nod);
      if (changes.ssh)
        notify('ssh', changes.ssh);
      if (changes.reconnect)
        notify('reconnect', changes.reconnect);
      if (changes.code)
        notify('code', changes.code);
      if (changes.exit !== undefined) {
        process.exit(changes.exit);
      }
      worker.postMessage(changes);
    }
    notify('endTerminal', {id, returnValue});
    return 'this is the secret secret string:' + returnValue.exitCode;
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
      if (freeShell)
        freeShell.then(x => x.shell.resize(size.cols, size.rows));
    }
  }
  // i have no idea why these needs promise.resolve
  Promise.resolve().then(() => ensureFreeShell());
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
  const os = require('os');
  const path = require('path');
  const socketDir = path.join(os.tmpdir(), '1d4-shell-sockets');
  const socketPath = path.join(socketDir, `${process.pid}-shell.sock`);
  const fs = require('fs');
  fs.mkdirSync(socketDir, {recursive: true, mode: 0o700});
  const net = require('net');
  try {fs.unlinkSync(socketPath); } catch {}
  const server = net.createServer();
  server.listen({
    path: socketPath,
  });
  process.on('exit', () => {
    server.close();
    try {fs.unlinkSync(socketPath);} catch {};
  });
  const uuid = require('crypto').randomUUID();
  await new Promise(x => server.once('listening', x));
  server.on('connection', async connection => {
    const transport = new (require('../protocol/pipeTransport').PipeTransport)(connection, connection);
    const message = await new Promise(x => transport.onmessage = x);
    if (message.uuid !== uuid) {
      console.error('invlid uuid', message.uuid, uuid);
      return;
    }
    const {id} = message;
    resolveShellConnection.get(id)(transport);
    resolveShellConnection.delete(id);
  });
  return {socketPath, uuid};
}
