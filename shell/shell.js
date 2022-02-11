//@ts-check
const path = require('path');
const EventEmitter = require('events');
const child_process = require('child_process');
const { PipeTransport } = require('../protocol/pipeTransport');
const { RPC } = require('../protocol/rpc');

class Shell extends EventEmitter {
  constructor() {
    super();
    this.process = child_process.spawn('node', [path.join(__dirname, 'worker.js')], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    const transport = new PipeTransport(this.process.stdin, this.process.stdout);
    this.rpc = RPC(transport, {
      cwd: cwd => {},
      env: env => {},
      data: data => {
        this.emit('data', data);
      },
    });
  }

  /**
   * @param {string} command
   */
  async runCommand(command) {
    if (!command)
      return {exitCode: 0};
    return this.rpc.send('runCommand', command);
  }

  resize(cols, rows) {
    return this.rpc.send('resize', {cols, rows});
  }

  /**
   * @param {string} code
   * @return {Promise<string>}
   */
  async evaluate(code) {
    return this.rpc.send('evaluate', code);

  }

  sendRawInput(input) {
    return this.rpc.send('sendRawInput', input);
  }

  close() {
    this.process.kill();
  }
}

module.exports = { Shell };