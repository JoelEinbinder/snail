//@ts-check
const path = require('path');
const child_process = require('child_process');
const { PipeTransport } = require('../protocol/pipeTransport');
const { RPC } = require('../protocol/rpc');

class Shell {
  constructor() {
    this.process = child_process.spawn('node', [path.join(__dirname, 'worker.js')], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    const transport = new PipeTransport(this.process.stdin, this.process.stdout);
    let urlCallback;
    this.urlPromise = new Promise(resolve => {
      urlCallback = resolve;
    });
    this.rpc = RPC(transport, {
      url: url => {
        urlCallback(url);
      },
    });
  }

  /**
   * @param {string} code
   * @return {Promise<string>}
   */
  async evaluate(code) {
    return this.rpc.send('evaluate', code);
  }

  /**
   * @param {string} dir
   */
  async chdir(dir) {
    return this.rpc.send('chdir', dir);
  }

  close() {
    this.process.kill();
  }
}

module.exports = { Shell };