//@ts-check
const {PipeTransport} = require('../protocol/pipeTransport');
const {RPC} = require('../protocol/rpc');
const {spawnJSProcess} = require('./spawnJSProcess');
const transport = new PipeTransport(process.stdout, process.stdin);
process.stdin.on('close', () => process.exit());
const spawnPromise = spawnJSProcess(process.cwd(), false);
spawnPromise.then(({child, socket: s}) => {
  socket = s;
  child.on('exit', code => process.exit(code));
  process.on('exit', () => child.kill());
  socket.onmessage = event => {
    rpc.notify('message', event.data);
  };
  rpc.notify('ready');
});
let socket;

const rpc = RPC(transport, {
  /** @param {string} data */
  async message(data) {
    const {socket} = await spawnPromise;
    socket.send(data);
  }
});
