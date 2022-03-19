const {spawn} = require('child_process');
const path = require('path');

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
    const child = spawn('ssh', [sshAddress, 'PATH=$PATH:/usr/local/bin node ~/gap-year/shell/wsPipeWrapper.js'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      detached: false,
      cwd: cwd || require('os').homedir(),
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
  if (!cwd || !require('fs').existsSync(cwd))
    cwd = require('os').homedir();
  const nodePath = process.execPath.endsWith('node') ? process.execPath : '/usr/local/bin/node';
  const child = spawn(nodePath, ['-e', `require(${JSON.stringify(path.join(__dirname, 'bootstrap.js'))})`], {
    stdio: 'pipe',
    detached: false,
    cwd,
  });
  const url = await waitForURL(child);
  /** @type {{send: (message:string) => void, close: () => void, onmessage?: (event: {data: string}) => void, onopen?: () => void}} */ 
  const socket = new (require('ws').WebSocket)(url);
  return {child, socket};
}

module.exports = {spawnJSProcess};