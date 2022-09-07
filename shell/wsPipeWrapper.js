//@ts-check
const {PipeTransport} = require('../protocol/pipeTransport');
const {RPC} = require('../protocol/rpc');
const {spawnJSProcess} = require('./spawnJSProcess');
const transport = new PipeTransport(process.stdout, process.stdin);
process.stdin.on('close', () => process.exit());
const {socketPath} = JSON.parse(atob(process.argv[2]));
const spawnPromise = spawnJSProcess({
  cwd: process.cwd(),
  sshAddress: false,
  socketPath,
});
spawnPromise.then((s) => {
  socket = s;
  s.onclose = () => process.exit();
  process.on('exit', () => s.close());
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
