const {spawn} = require('child_process');
const path = require('path');
const fs = require('fs');

/** @return {Promise<string>} */
async function waitForURL(child) {
  let buffer = '';
  let resolve;
  const promise = new Promise(r => resolve = r);
  child.stderr.on('data', onData);
  const url = await promise;
  child.stderr.off('data', onData);
  return url;
  function onData(data) {
    buffer += data.toString();
    const regex = /Debugger listening on (.*)/
    const result = regex.exec(buffer);
    if (!result)
      return;
    resolve(result[1]);
  }
}

async function spawnJSProcess(cwd, sshAddress) {
  if (sshAddress) {
    /** @type {{send: (message:string) => void, close: () => void, onmessage?: (event: {data: string}, onopen?: () => void) => void}} */ 
    const socket = {
      send(message) {
        rpc.notify('message', message);
      },
      close() {
        child.kill();
      },
      onmessage: undefined
    };
    if (!cwd)
      cwd = require('os').homedir();
    const child = spawn('ssh', [sshAddress, 'PATH=$PATH:/usr/local/bin node ~/gap-year/shell/wsPipeWrapper.js'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      detached: false,
      cwd,
      env: {...process.env, PWD: cwd}
    });
    const {RPC} = require('../protocol/rpc');
    const {PipeTransport} = require('../protocol/pipeTransport');
    const transport = new PipeTransport(child.stdin, child.stdout);
    const rpc = RPC(transport, {
      message: data => {
        socket.onmessage && socket.onmessage({data});
      },
      ready: () => {
        socket.onopen && socket.onopen();
      }
    });

    return {child, socket};
  }
  if (!cwd || !fs.existsSync(cwd))
    cwd = require('os').homedir();
  const os = require('os');
  const socketDir = path.join(os.tmpdir(), '1d4-sockets');

  fs.mkdirSync(socketDir, {recursive: true, mode: 0o700});

  const nodePath = process.execPath.endsWith('node') ? process.execPath : '/usr/local/bin/node';
  const child = spawn(nodePath, ['-e', `require(${JSON.stringify(path.join(__dirname, 'bootstrap.js'))})`], {
    stdio: 'ignore',
    detached: false,
    cwd,
  });
  const socketPath = path.join(socketDir, `${child.pid}.socket`);
  
  const net = require('net');
  while (true) {
    if (fs.existsSync(socketPath))
      break;
    // TODO use fs.watch on linux and fsevents on macos
    await new Promise(x => setTimeout(x, 25));
  }
  /** @type {net.Socket} */
  const unixSocket = net.connect({
    path: socketPath,
  });
  
  unixSocket.once('ready', () => {
    socket.onopen?.();
  });

  const {PipeTransport} = require('../protocol/pipeTransport');
  const transport = new PipeTransport(unixSocket, unixSocket);
  transport.onmessage = message => {
    socket?.onmessage?.({data: JSON.stringify(message)});
  }
  
  /** @type {{send: (message:string) => void, close: () => void, onmessage?: (event: {data: string}) => void, onopen?: () => void}} */ 
  const socket = {
    close() {
      unixSocket.end();
    },
    send(message) {
      transport.sendString(message);
    }
  }
  
  return {child, socket};
}

module.exports = {spawnJSProcess};