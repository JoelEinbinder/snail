const { spawn, spawnSync } = require('child_process');
const path = require('path');
const { PipeTransport } = require('../../protocol/pipeTransport');
const { RPC } = require('../../sdk/rpc-js');
let lastTerminalId = 0;
class PythonController {
  /**
   * @param {(notification: any) => void} notificationListener
   */
  constructor(notificationListener) {
    this.pythonPath = spawnSync('which', ['python3']).stdout.toString().trim();
    //@ts-ignore
    const {open} = require('../../node-pty/build/Release/pty.node');
    /** @type {{slave: number, master: number, pty: string }} */
    const {slave, master, pty} = open(80, 24);
    const tty = require('tty');
    this._stream = new tty.ReadStream(master);
    /**
     * @template {keyof import('../runtime-types').Runtime} T
     * @param {T} method
     * @param {import('../runtime-types').Runtime[T]} params
     */
    this._sendRuntimeNotification = (method, params) => {
      notificationListener({
        method: 'Shell.notify',
        params: {payload: { method, params }}
      });
    }
    this._terminalId = null; // we shouldn't have any stdout on startup. Sending startTerminal will clear the prompt

    this._stream.setEncoding('utf8');
    this._stream.on('error', e => {
      console.error('e', e);
    })
    this.master = master;
    this.slave = slave;
    let threadCallback = null;
    let last = '';
    let magicString = '';
    this._stream.on('data', d => {
      let data = last + d.toString();
      const sendData = () => {
        if (!this._terminalId)
          this._startNewTerminal();
        this._sendRuntimeNotification('data', {
          id: this._terminalId,
          data,
        });
      }
      if (threadCallback && data.slice(data.length - magicString.length).toString() === magicString) {
        data = data.slice(0, -magicString.length);
        if (data) {
          sendData();
          last = '';
        }
        const cb = threadCallback;
        threadCallback = null;
        cb();
        return;
      }
      const magicMaybeStart = data.lastIndexOf(magicString[0]);
      if (magicMaybeStart !== -1 && magicString.startsWith(data.slice(magicMaybeStart))) {
        last = data.slice(magicMaybeStart);
        data = data.slice(0, magicMaybeStart);
      } else {
        last = '';
      }
      if (data)
        sendData();
    });
    this._threadStdio = async () => {
      const magicToken = String(Math.random());
      magicString = `\x1B[JOELMAGIC${magicToken}]`;
      const promise = new Promise(resolve => threadCallback = resolve);
      await this.send('Python.threadStdio', {
        text: magicString,
      });
      return promise;
    }

    this.process = spawn(this.pythonPath, [path.join(__dirname, 'runtime.py')], {
      stdio: [slave, slave, slave, 'pipe'],
      detached: true,
      env: {
        ...process.env,
        MPLBACKEND: 'module://_snail_plt_backend'
      }
    });
    const socket = /** @type {import('net').Socket} */(this.process.stdio[3]);
    this._transport = new PipeTransport(socket, socket, '\n');
    this._rpc = RPC(this._transport, event => {
      notificationListener(event);
    });

  }

  _startNewTerminal() {
    this._terminalId = 'python-' + lastTerminalId++;
    this._sendRuntimeNotification('startTerminal', { id: this._terminalId })
  }

  _endTerminal() {
    this._sendRuntimeNotification('endTerminal', { id: this._terminalId })
    this._terminalId = null;
  }

  sendInput(data) {
    this._stream.write(data);
  }

  resize({rows, cols}) {
    //@ts-ignore
    const {resize} = require('../../node-pty/build/Release/pty.node');
    resize(this.master, cols, rows);
  }

  async runCommand(expression) {
    this._startNewTerminal();
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: false,
      generatePreview: true,
      userGesture: true,
      replMode: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    await this._threadStdio();
    this._endTerminal();
    return result;
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