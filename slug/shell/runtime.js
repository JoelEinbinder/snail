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
  /**
   * @param {number} rows
   * @param {number} cols
   */
  constructor(cols, rows) {
      super();
      //@ts-ignore
      const {open, resize} = require('../node-pty/build/Release/pty.node');
      /** @type {{slave: number, master: number, pty: string }} */
      const {slave, master, pty} = open(cols, rows);
      this._process = child_process.fork(require.resolve('../shjs/wrapper.js'), [], {
        stdio: [slave, slave, slave, 'ipc'],
        detached: true,
      });
      
      this.closePromise = new Promise(x => this._process.once('exit', () => x({exitCode: -1, died: true})));
      this.startupPromise = Promise.race([
        new Promise(x => this._process.once('message', x)),
        this.closePromise,
      ]);
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
  
  destroy() {
    this._process.kill();
    this._stream.destroy();
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
  /** @type {Map<number, Shell>} */
  _shells = new Map();

  /** @type {WeakSet<Shell>} */
  _wroteToStdin = new WeakSet();
  _shellId = 0;
  _rows = 24;
  _cols = 80;
  /** @type {Shell|null} */
  _freeShell = null;
  /** @type {Map<number, AbortController>} */
  _abortControllers = new Map();
  /** @type {Promise<{socketPath: string, uuid: string}>|null} */
  _serverPromise = null;

  constructor() {
    this.handler = {
      input: ({id, data}) => {
        const shell = this._shells.get(id);
        if (!shell) {
          console.error('writing to nonexistant shell', {data});
          return;
        }
        this._wroteToStdin.add(shell);
        shell.write(data);
      },
      resize: (size) => {
        this._rows = size.rows;
        this._cols = size.cols;
        for (const shell of this._shells.values())
          shell.resize(size.cols, size.rows);
        this._freeShell?.resize(size.cols, size.rows);
      }
    }
  }

  /**
   * @param {import('./runtime-types').NotifyFunction} _notify 
   */
  setNotify(_notify) {
    this._notify = _notify;
  }

  ensureFreeShell() {
    if (this._freeShell)
      return this._freeShell;
    return this._freeShell = new Shell(this._cols, this._rows);
  }

  _claimFreeShell() {
    const myshell = this.ensureFreeShell();
    this._freeShell = null;
    return myshell;
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
    const shell = this._claimFreeShell();
    await shell.startupPromise;
    if (abortSignal?.aborted) {
      shell.destroy();
      return 'this is the secret secret string:0';
    }
    const abort = () => {
      // silence all errors after we are done
      readStream.on('error', e => {});
      writeStream.on('error', e => {});
      shell.destroy();
    };
    const fs = require('fs');
    const net = require('net');
    const writeStream = fs.createWriteStream('', {
      fd: shell.slave,
      autoClose: false,
    });
    const readStream = fs.createReadStream('', {
      fd: shell.slave,
      autoClose: false,
    });
    abortSignal?.addEventListener('abort', abort);
    shell.pause();
    const magicToken = String(Math.random());
    const magicString = `\x1B[JOELMAGIC${magicToken}]\r\n`;
    const closePromise = shell.runCommand(command, magicToken, !!previewToken);

    const id = ++this._shellId;
    this._shells.set(id, shell);
    this._notify('startTerminal', {id, previewToken});
    let waitForDoneCallback;
    const waitForDonePromise = Promise.race([
      new Promise(x => waitForDoneCallback = x),
      shell.closePromise,
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
    shell.on('data', onData);
    shell.resume();
    /** @type {{changes?: Changes, exitCode: number, died?: boolean}} */
    const returnValue = await closePromise;
    await waitForDonePromise;
    abortSignal?.removeEventListener('abort', abort);
    if (previewToken)
      this._abortControllers.delete(previewToken);
    this._shells.delete(id);
    // silence all errors after we are done
    readStream.on('error', e => {});
    writeStream.on('error', e => {});
    shell.off('data', onData);
    if (this._freeShell || returnValue.died) {
      shell.destroy();
    } else {
      if (this._wroteToStdin.has(shell)) {
        // Don't reuse a shell if it had stdin written to it, because it might leak into the next command.
        // We do something fancy to flush it out.
        const data = await shell.flushStdin();
        this._notify('leftoverStdin', {id, data, previewToken})
        shell.destroy();
      } else {
        // This is where we reuse shells.
        this._freeShell = shell;
      }
    }
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
    this._freeShell?.destroy();
  }
}


module.exports = { Runtime }