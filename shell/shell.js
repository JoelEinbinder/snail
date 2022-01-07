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
    this.shell = pty.spawn('bash', [path.join(__dirname, 'proxy.sh'), magicToken], {
      rows: process.stdout.rows,
      cols: process.stdout.columns,
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
      this.emit('data', data);
    });
    this.shell.onExit(event => this.emit('close', event.exitCode, event.signal));
  }
  async runCommand(command) {
    if (this.inCommand) {
      console.error('already in command!');
      return;
    }
    this.ignoreText = command + '\r\n';
    this.shell.write(command + '\n');
    await new Promise(x => magicCallback = x);
  }

  sendRawInput(input) {
    this.shell.write(input);
  }

  close() {
    this.shell.kill();
  }
}

module.exports = { Shell };