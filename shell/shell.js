//@ts-check
const path = require('path');
const pty = require('node-pty');
const EventEmitter = require('events');
const child_process = require('child_process');
const magicToken = `\x33[JOELMAGIC${Math.random()}]`;
const magicString = magicToken + '\r\n';
let magicCallback = null;

class Shell extends EventEmitter {
  constructor() {
    super();
    this.rows = 80;
    this.cols = 24;
    this.env = {...process.env};
    this.cwd = process.cwd();
    this.inCommand = false;
    this.ignoreText = '';
    this.evaluating = false;
    this.evaluateResult = '';
    this.commandQueue = Promise.resolve();
  }

  /**
   * @param {string} command
   */
  async runCommand(command) {
    return this.commandQueue = this.commandQueue.then(() => this._innerRunCommand(command));
  }

  resize(cols, rows) {
    this.rows = rows;
    this.cols = cols;
    if (this.shell)
      this.shell.resize(cols, rows);
  }

  /**
   * @param {string} command
   */
  async _innerRunCommand(command) {
    this.shell = pty.spawn('node', [path.join(__dirname, '..', 'shjs', 'wrapper.js'), command, magicToken], {
      env: this.env,
      rows: this.rows,
      cols: this.cols,
      cwd: this.cwd,
      name: 'xterm-256color',
      handleFlowControl: true,
      encoding: null,
    });
    let extraData = '';
    let inExtraData = false;
    this.shell.onData(data => {
      if (!inExtraData && data.slice(data.length - magicString.length).toString() === magicString) {
        data = data.slice(0, -magicString.length);
        inExtraData = true;
      }
      if (inExtraData)
        extraData += data;
      else
        this.emit('data', data);
    });
    await new Promise(x => this.shell.onExit(x));
    this.shell = null;
    if (extraData.length) {
      const changes = JSON.parse(extraData);
      if (changes.cwd)
        this.cwd = changes.cwd;
      if (changes.env) {
        for (const key in changes.env)
          this.env[key] = changes.env[key];
      }
    }
  }

  /**
   * @param {string} code
   * @return {Promise<string>}
   */
  async evaluate(code) {
    // return '';
    const child = child_process.spawn('node', [path.join(__dirname, '..', 'shjs', 'wrapper.js'), code], {
      env: this.env,
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const data = [];
    child.stdin.end();
    child.stderr.on('data', d => data.push(d));
    child.stdout.on('data', d => data.push(d));
    await new Promise(x => child.on('exit', x));
    return data.join('');
  }

  sendRawInput(input) {
    if (this.shell)
      this.shell.write(input);
  }

  close() {
    if (this.shell)
      this.shell.kill();
  }
}

module.exports = { Shell };