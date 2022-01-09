//@ts-check
const path = require('path');
const pty = require('node-pty');
const EventEmitter = require('events');
const magicToken = `\x33[JOELMAGIC${Math.random()}]`;
const magicString = magicToken + '\r\n';
let magicCallback = null;

class Shell extends EventEmitter {
  constructor() {
    super();
    this.inCommand = false;
    this.ignoreText = '';
    this.evaluating = false;
    this.evaluateResult = '';
    this.commandQueue = Promise.resolve();
    this.shell = pty.spawn('bash', [path.join(__dirname, 'proxy.sh'), magicToken], {
      rows: 80,
      cols: 24,
      cwd: process.cwd(),
      name: 'xterm-256color',
      handleFlowControl: true,
      encoding: null,
    });
    this.shell.onData(data => {
      const dataString = data.toString();
      let index = 0;
      for (index = 0; index < this.ignoreText.length && index < dataString.length; index++) {
        if (dataString[index] !== this.ignoreText[index]) {
          this.ignoreText = '';
          break;
        }
      }
      if (index > 0) {
        data = data.slice(index);
        this.ignoreText = this.ignoreText.slice(index);
      }
      if (magicCallback && data.slice(data.length - magicString.length).toString() === magicString) {
        data = data.slice(0, -magicString.length);
        magicCallback();
        magicCallback = null;
      }
      if (this.evaluating)
        this.evaluateResult += data;
      else
        this.emit('data', data);
    });
    this.shell.onExit(event => this.emit('close', event.exitCode, event.signal));
  }

  /**
   * @param {string} command
   */
  async runCommand(command) {
    return this.commandQueue = this.commandQueue.then(() => this._innerRunCommand(command));
  }

  /**
   * @param {string} command
   */
  async _innerRunCommand(command) {
    this.ignoreText = command + '\r\n';
    this.shell.write(command + '\n');
    await new Promise(x => magicCallback = x);
  }

  /**
   * @param {string} code
   * @return {Promise<string>}
   */
  async evaluate(code) {
    let result;
    this.commandQueue = this.commandQueue.then(async () => {
      this.evaluating = true;
      await this._innerRunCommand(code);
      this.evaluating = false;
      result = this.evaluateResult;
      this.evaluateResult = '';
    });
    await this.commandQueue;
    return result;
  }

  sendRawInput(input) {
    this.shell.write(input);
  }

  close() {
    this.shell.kill();
  }
}

module.exports = { Shell };