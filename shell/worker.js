//@ts-check
const {PipeTransport} = require('../protocol/pipeTransport');
const {RPC} = require('../protocol/rpc');
const transport = new PipeTransport(process.stdout, process.stdin);
process.stdin.on('close', () => process.exit());

const rpc = RPC(transport, {
  /** @param {string} code */
  async evaluate(code) {
    const {getResult} = require('../shjs/index');
    const {output} = await getResult(code);
    return output;
  },
  /** @param {string} dir */
  async chdir(dir) {
    process.chdir(dir);
  }
});
