const {spawn} = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * @typedef {{
 * send: (message:string) => void,
 * close: () => void,
 * onmessage?: (event: {data: string}) => void,
 * readyPromise: Promise<void>,
 * onclose?: () => void,
 * }} JSSocket
 */

/**
 * @return {{err?: import('stream').Readable, socketPromise: Promise<JSSocket>}}
 */
function spawnJSProcess({cwd, nodePath, bootstrapPath}) {
  // launch the process if we don't have an explicit socket to connect to
  if (!cwd || !fs.existsSync(cwd))
    cwd = require('../path_service/').homedir();
  const pathService = require('../path_service/');
  const socketDir = path.join(pathService.tmpdir(), 'snail-sockets');
  if (socketDir.length > 90)
    throw new Error(`Cannot create socket in ${JSON.stringify(socketDir)} (path too long)`);
  fs.mkdirSync(socketDir, {recursive: true, mode: 0o700});

  const child = spawn(nodePath, ['-e', `require(${JSON.stringify(bootstrapPath)})`], {
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: true,
    cwd,
    env: {
      ...process.env,
      PATH: `${path.join(bootstrapPath, '..', '..', 'include', 'bin')}:${process.env.PATH}`,
      EDITOR: path.join(bootstrapPath, '..', '..', 'include', 'bin', 'edit'),
      TERM: 'xterm-256color',
    }
  });

  const socketPath = path.join(socketDir, `${child.pid}.socket`);
  const waitForSocketPath = new Promise(async resolve => {
    while (true) {
      if (fs.existsSync(socketPath))
        break;
      // TODO use fs.watch on linux and fsevents on macos
      await new Promise(x => setTimeout(x, 25));
    }
    resolve();
  });
  return {
    err: child.stderr,
    socketPromise: waitForSocketPath.then(() => connectToSocket(socketPath))
  }
}

async function connectToSocket(socketPath) {
  const net = require('net');

  /** @type {net.Socket} */
  let unixSocket;
  for (let i = 0; i < 10; i++) {
    try {
      unixSocket = net.connect({
        path: socketPath,
      });    
      const readyPromise = new Promise(resolve => unixSocket.once('ready', resolve));
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
        },
        readyPromise,
      }
      
      await new Promise((resolve, reject) => {
        unixSocket.once('connect', resolve);
        unixSocket.once('error', reject);
      });
      return socket;
    } catch (e) {
      console.error('error connecting to socket', e);
      await new Promise(x => setTimeout(x, 100));
    }
  }
  throw new Error('Failed to connect to socket after 10 attempts');
}

module.exports = {spawnJSProcess, connectToSocket};