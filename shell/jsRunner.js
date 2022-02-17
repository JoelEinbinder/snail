const {spawn} = require('child_process');
const EventEmitter = require('events');
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

async function connect() {
  const child = spawn(process.execPath, ['-e', `process.stdin.on('data', () => void 0); require('inspector').open(undefined, undefined, true);  `], {
    stdio: 'pipe',
    detached: false
  });
  const url = await waitForURL(child);
  const ws = require('ws');
  const socket = new ws.WebSocket(url);
  /** @type {import('./protocol').Connection} */
  const connection = new Connection(socket);
  connection.kill = () => child.kill();
  await new Promise((x, r) => {
    socket.onopen = x;
    socket.onerror = r;
  });
  await connection.send('Runtime.runIfWaitingForDebugger');
  return connection;
}

connect().then(async connection => {
  console.log(await connection.send('Runtime.evaluate', {expression: 'process.argv', returnByValue: false, generatePreview: true}));
  connection.kill();
});

class Connection extends EventEmitter {
  /**
   * @param {import('ws').WebSocket} transport
   */
  constructor(transport) {
    super(); 
    this.transport = transport;
    this._id = 0;
    this._callbacks = new Map();
    this.transport.on('message', data => {
      const message = JSON.parse(data);
      if ('id' in message) {
        const callback = this._callbacks.get(message.id);
        callback.call(null, message);
        this._callbacks.delete(message.id);
      } else {
        this.emit(message.method, message.params);
      }
    })
  }
  async send(method, params) {
    const id = this._id++;
    const message = {id, method, params};
    const promise = new Promise(x => this._callbacks.set(id, x));
    this.transport.send(JSON.stringify(message));
    const data = await promise;
    if (data.error)
      throw new Error(method + ': ' + data.error.message);
    return data.result;
  }
}
