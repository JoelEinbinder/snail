//@ts-check
const path = require('path');
const child_process = require('child_process');
const { PipeTransport } = require('../protocol/pipeTransport');
const { RPC } = require('../protocol/rpc');

class Shell {
  /** @param {string=} sshAddress */
  constructor(sshAddress) {
    if (sshAddress) {
      this.process = child_process.spawn('ssh', [sshAddress, 'PATH=$PATH:/usr/local/bin node ~/gap-year/shell/worker.js'], {
        stdio: ['pipe', 'pipe', 'inherit'],
      });
    } else {
      const nodePath = process.execPath.endsWith('node') ? process.execPath : '/usr/local/bin/node';
      this.process = child_process.spawn(nodePath, [path.join(__dirname, 'worker.js')], {
        stdio: ['pipe', 'pipe', 'inherit'],
      });
    }
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

  async env(env) {
    return this.rpc.send('env', env);
  }

  async requestFile(filePath) {
    return this.rpc.send('requestFile', filePath);
  }

  close() {
    this.process.kill();
  }
}

module.exports = { Shell };