//@ts-check
const { EventEmitter } = require('stream');
const {setAlias, getAndResetChanges, execute, getAliases} = require('../shjs/index');
const path = require('path');
const child_process = require('child_process');

/**
 * @typedef {{
 * env?: {[key: string]: string},
 * aliases?: {[key: string]: string[]},
 * cwd?: string,
 * nod?: string[],
 * ssh?: { sshAddress: string, sshArgs: string[], env: NodeJS.ProcessEnv },
 * reconnect?: string,
 * code?: string,
 * exit?: number,
 * }} Changes
 */

class Shell extends EventEmitter {
  _lock = Promise.resolve();
  constructor() {
      super();
      //@ts-ignore
      const {open} = require('../node-pty/build/Release/pty.node');
      /** @type {{slave: number, master: number, pty: string }} */
      const {slave, master, pty} = open(80, 24);
      this.claim().then(release => {
        this._setupProcess().then(release);
      });
      
      const tty = require('tty');
      this._stream = new tty.ReadStream(master);
      this._stream.setEncoding('utf8');
      this._stream.on('error', e => {
        console.error('e', e);
      })
      this.master = master;
      this.slave = slave;
      this._stream.on('data', d => {
        this.emit('data', d);
      });
  }

  resize(cols, rows) {
    //@ts-ignore
    const {resize} = require('../node-pty/build/Release/pty.node');
    resize(this.master, cols, rows);
  }

  async _setupProcess() {
    this._process = child_process.fork(require.resolve('../shjs/wrapper.js'), [], {
      stdio: [this.slave, this.slave, this.slave, 'ipc'],
      detached: true,
    });
    
    this.closePromise = new Promise(x => this._process.once('exit', () => x({exitCode: -1, died: true})));
    await Promise.race([
      new Promise(x => this._process.once('message', x)),
      this.closePromise,
    ]);
  }

  async claim() {
    /** @type {() => void} */
    let releaseShell;
    /** @type {Promise<void>} */
    const promise = new Promise(x => releaseShell = x);
    const wait = this._lock;
    this._lock = promise;
    await wait;
    return releaseShell;
  }
  
  softKill() {
    this._process.send({
      method: 'kill',
    });
  }

  async destroy() {
    const release = await this.claim();
    this._process.kill();
    this._stream.destroy();
    release();
  }

  write(data) {
    this._stream.write(data);
  }

  pause() {
    this._stream.pause();
  }

  resume() {
    this._stream.resume();
  }

  /**
   * @param {string} command
   * @param {string} magicToken
   * @param {boolean} noSideEffects
   */
  runCommand(command, magicToken, noSideEffects) {
    this._process.send({
      method: 'command',
      params: {
        command,
        env: process.env,
        dir: process.cwd(),
        aliases: getAliases(),
        magicToken,
        noSideEffects,
      }
    });
    return Promise.race([
      this.closePromise,
      new Promise(x => this._process.once('message', x)),
    ]);
  }

  async flushStdin() {
    const stdinEndToken = String(Math.random()) + '\n';
    this._process.send({method: 'fush-stdin', params: {stdinEndToken}});
    this.write(stdinEndToken);
    return Promise.race([
      this.closePromise.then(() => ({data: ''})),
      new Promise(x => this._process.once('message', x)),
    ]);

  }
}

class Runtime {
  /** @type {Map<number, (s: import('../protocol/pipeTransport').PipeTransport) => void>} */
  _resolveShellConnection = new Map();
  /** @type {import('./runtime-types').NotifyFunction} */
  _notify;

  _wroteToStdin = false;
  _shellId = 0;
  _shell = new Shell();
  /** @type {Map<number, AbortController>} */
  _abortControllers = new Map();
  /** @type {Promise<{socketPath: string, uuid: string}>|null} */
  _serverPromise = null;

  constructor() {
    this.handler = {
      input: ({id, data}) => {
        this._wroteToStdin = true;
        this._shell.write(data);
      },
      resize: (size) => {
        this._shell.resize(size.cols, size.rows);
      }
    }
  }

  /**
   * @param {import('./runtime-types').NotifyFunction} _notify 
   */
  setNotify(_notify) {
    this._notify = _notify;
  }

  /**
   * @param {string} command
   * @param {number=} previewToken
   * @return {Promise<string>}
   */
  async pty(command, previewToken) {
    if (!command)
      return 'this is the secret secret string:0';
    /** @type {AbortSignal|null} */
    let abortSignal = null;
    if (previewToken) {
      const controller = new AbortController();
      abortSignal = controller.signal;
      this._abortControllers.set(previewToken, controller);
    }
    const releaseShell = await this._shell.claim();
    if (abortSignal?.aborted) {
      releaseShell();
      return 'this is the secret secret string:0';
    }
    const abort = () => {
      // silence all errors after we are done
      readStream.on('error', e => {});
      writeStream.on('error', e => {});
      this._shell.softKill();
    };
    const fs = require('fs');
    const writeStream = fs.createWriteStream('', {
      fd: this._shell.slave,
      autoClose: false,
    });
    const readStream = fs.createReadStream('', {
      fd: this._shell.slave,
      autoClose: false,
    });
    abortSignal?.addEventListener('abort', abort);
    this._shell.pause();
    const magicToken = String(Math.random());
    const magicString = `\x1B[JOELMAGIC${magicToken}]\r\n`;
    const closePromise = this._shell.runCommand(command, magicToken, !!previewToken);
    const id = ++this._shellId;
    this._notify('startTerminal', {id, previewToken});
    let waitForDoneCallback;
    const waitForDonePromise = Promise.race([
      new Promise(x => waitForDoneCallback = x),
      this._shell.closePromise,
    ]);
    let last = '';
    /** @type {(data: Buffer|string) => void} */
    const onData = d => {
      let data = last + d.toString();
      if (data.slice(data.length - magicString.length).toString() === magicString) {
        data = data.slice(0, -magicString.length);
        if (data) {
          this._notify('data', {id, data, previewToken});
          last = '';
        }
        waitForDoneCallback();
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
        this._notify('data', {id, data, previewToken});
    };
    this._shell.on('data', onData);
    this._shell.resume();
    /** @type {{changes?: Changes, exitCode: number, died?: boolean}} */
    const returnValue = await closePromise;
    await waitForDonePromise;
    abortSignal?.removeEventListener('abort', abort);
    if (previewToken)
      this._abortControllers.delete(previewToken);
    // silence all errors after we are done
    readStream.on('error', e => {});
    writeStream.on('error', e => {});
    this._shell.off('data', onData);
    this._shell.pause();
    if (this._wroteToStdin) {
      // If it had stdin written to it, it might leak into the next command.
      // We do something fancy to flush it out.
      this._wroteToStdin = false;
      const data = await this._shell.flushStdin();
      this._notify('leftoverStdin', {id, data, previewToken})
    }
    releaseShell();
    const {changes} = returnValue;
    if (changes && !previewToken) {
      if (changes.cwd) {
        // process.chdir will call notify
        process.chdir(changes.cwd);
      }
      if (changes.env) {
        for (const key in changes.env) {
          process.env[key] = changes.env[key];
        }
        this._notify('env', changes.env);
      }
      if (changes.aliases) {
        this._notify('aliases', changes.aliases);
        for (const key of Object.keys(changes.aliases)) {
          setAlias(key, changes.aliases[key]);
        }
      }
      if (changes.nod)
        this._notify('nod', changes.nod);
      if (changes.ssh)
        this._notify('ssh', changes.ssh);
      if (changes.reconnect)
        this._notify('reconnect', changes.reconnect);
      if (changes.code)
        this._notify('code', changes.code);
      if (changes.exit !== undefined) {
        process.exit(changes.exit);
      }
    }
    this._notify('endTerminal', {id, previewToken});
    return 'this is the secret secret string:' + returnValue.exitCode;
  }

  /**
   * @param {number} previewToken
   */
  abortPty(previewToken) {
    this._abortControllers.get(previewToken)?.abort();
  };

  respond(data) {
    const {method, params} = data;
    this.handler[method](params);
  }

  dispose() {
    this._shell.destroy();
  }
}


module.exports = { Runtime }