const { spawn, spawnSync } = require('child_process');
const path = require('path');
const { PipeTransport } = require('../../protocol/pipeTransport');
const { RPC } = require('../../sdk/rpc-js');
class PythonController {
  /**
   * @param {(notification: any) => void} notificationListener
   */
  constructor(notificationListener) {
    this.pythonPath = spawnSync('which', ['python3']).stdout.toString().trim();
    this.process = spawn(this.pythonPath, [path.join(__dirname, 'runtime.py')], {
      stdio: ['inherit', 'inherit', 'inherit', 'pipe'],
    });
    const socket = /** @type {import('net').Socket} */(this.process.stdio[3]);
    this._transport = new PipeTransport(socket, socket, '\n');
    this._rpc = RPC(this._transport, event => {
      notificationListener(event);
    });
  }

  send(method, params) {
    return this._rpc.send(method, params);
  }

  notify(method, params) {
    this._rpc.notify(method, params);
  }

  close() {
    this.process.kill();
  }
}

module.exports = { PythonController };