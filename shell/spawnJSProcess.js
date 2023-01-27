const {spawn} = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * @typedef {{
 * send: (message:string) => void,
 * close: () => void,
 * onmessage?: (event: {data: string},
 * onopen?: () => void) => void
 * onclose?: () => void
 * }} JSSocket
 */

async function spawnJSProcess({cwd, sshAddress, socketPath}) {
  if (sshAddress) {
    /** @type {JSSocket} */ 
    const socket = {
      send(message) {
        rpc.notify('message', message);
      },
      close() {
        child.kill();
      },
    };
    if (!cwd)
      cwd = require('../path_service/').homedir();
    const child = spawn('ssh', [sshAddress, `PATH=$PATH:/usr/local/bin node ~/gap-year/shell/wsPipeWrapper.js '${btoa(JSON.stringify({socketPath}))}'`], {
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
    transport.onclose = () => socket.onclose?.();

    return socket;
  }
  if (!socketPath) {
    // launch the process if we don't have an explicit socket to connect to
    if (!cwd || !fs.existsSync(cwd))
      cwd = require('../path_service/').homedir();
    const pathService = require('../path_service/');
    const socketDir = path.join(pathService.tmpdir(), '1d4-sockets');
    if (socketDir.length > 90)
      throw new Error(`Cannot create socket in ${JSON.stringify(socketDir)} (path too long)`);
    fs.mkdirSync(socketDir, {recursive: true, mode: 0o700});

    const nodePath = process.execPath.endsWith('node') ? process.execPath : '/usr/local/bin/node';
    const child = spawn(nodePath, ['-e', `require(${JSON.stringify(path.join(__dirname, 'bootstrap.js'))})`], {
      stdio: 'ignore',
      detached: true,
      cwd,
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:${path.join(__dirname, '..', 'include', 'bin')}`,
      }
    });

    socketPath = path.join(socketDir, `${child.pid}.socket`);
    while (true) {
      if (fs.existsSync(socketPath))
        break;
      // TODO use fs.watch on linux and fsevents on macos
      await new Promise(x => setTimeout(x, 25));
    }
  }
  return connectToSocket(socketPath);
}

function connectToSocket(socketPath) {
  const net = require('net');

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
  transport.onclose = () => socket.onclose?.();
  
  /** @type {JSSocket} */ 
  const socket = {
    close() {
      unixSocket.end();
    },
    send(message) {
      transport.sendString(message);
    }
  }
  
  return socket;
}

module.exports = {spawnJSProcess};