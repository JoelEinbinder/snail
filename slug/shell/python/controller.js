const { spawn } = require('child_process');
const path = require('path');
const { PipeTransport } = require('../../protocol/pipeTransport');
const { RPC } = require('../../sdk/rpc-js');
class PythonController {
  constructor() {
    this.process = spawn('python3', [path.join(__dirname, 'runtime.py')], {
      stdio: ['inherit', 'inherit', 'inherit', 'pipe'],
    });
    const socket = /** @type {import('net').Socket} */(this.process.stdio[3]);
    this._transport = new PipeTransport(socket, socket, '\n');
    this._rpc = RPC(this._transport, event => {
      console.log('event from python', event);
    });
  }

  send(method, params) {
    return this._rpc.send(method, params);
  }

  close() {
    this.process.kill();
  }
}

module.exports = { PythonController };