//@ts-check
const {setAlias, getAliases} = require('../shjs/index');
const path = require('path');

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

class Runtime {
  /** @type {Map<number, (s: import('../protocol/pipeTransport').PipeTransport) => void>} */
  _resolveShellConnection = new Map();
  /** @type {import('./runtime-types').NotifyFunction} */
  _notify;
  /** @type {Map<number, import('node-pty').IPty>} */
  _shells = new Map();

  /** @type {WeakSet<import('node-pty').IPty>} */
  _wroteToStdin = new WeakSet();
  _shellId = 0;
  _rows = 24;
  _cols = 80;
  /** @type {Promise<{shell: import('node-pty').IPty, connection: import('../protocol/pipeTransport').PipeTransport}>|null} */
  _freeShell = null;
  /** @type {Map<number, AbortController>} */
  _abortControllers = new Map();
  /** @type {Promise<{socketPath: string, uuid: string}>|null} */
  _serverPromise = null;

  constructor(socketDir = path.join(require('../path_service/').tmpdir(), 'snail-shell-sockets')) {
    this._socketDir = socketDir;
    this.handler = {
      input: ({id, data}) => {
        const shell = this._shells.get(id);
        if (!shell)
          return;
        this._wroteToStdin.add(shell);
        shell.write(data);
      },
      resize: (size) => {
        this._rows = size.rows;
        this._cols = size.cols;
        for (const shell of this._shells.values())
          shell.resize(size.cols, size.rows);
        if (this._freeShell)
          this._freeShell.then(x => x.shell.resize(size.cols, size.rows));
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
    return this._freeShell = new Promise(async resolve => {
      const id = ++this._shellId;
      const {socketPath, uuid} = await this._getServerUrl();
      /** @type {Promise<import('../protocol/pipeTransport').PipeTransport>|import('../protocol/pipeTransport').PipeTransport} */
      const connectionPromise = new Promise(x => this._resolveShellConnection.set(id, x));
      // node won't read these later from the process.env, so we need to set them now
      /** @type {{[key: string]: string}} */
      const env = {};
      // somehow undefined will get stringified to 'undefined' here
      for (const key of ['TMP', 'TEMP', 'TMPDIR', 'NODE_PATH']) {
        if (process.env[key])
          env[key] = process.env[key];
      }
      const shell = require('node-pty').spawn(process.execPath, [require('path').join(__dirname, '..', 'shjs', 'wrapper.js'), socketPath, uuid, String(id)], {
        env,
        rows: this._rows,
        cols: this._cols,
        cwd: process.cwd(),
        name: 'xterm-256color',
        handleFlowControl: true,
        encoding: null,
      });
      const connection = await connectionPromise;
      resolve({shell, connection });
    });
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
    /** @type {AbortSignal|null} */
    let abortSignal = null;
    if (previewToken) {
      const controller = new AbortController();
      abortSignal = controller.signal;
      this._abortControllers.set(previewToken, controller);
    }
    const magicToken = String(Math.random());
    const magicString = `\x1B[JOELMAGIC${magicToken}]\r\n`;
    const {shell, connection} = await this._claimFreeShell();
    if (abortSignal?.aborted) {
      shell.kill();
      return 'this is the secret secret string:0';
    }
    const abort = () => {
      shell.kill();
    }
    abortSignal?.addEventListener('abort', abort);
    const connectionDonePromise = new Promise(x => {
      connection.onmessage = data => {
        delete connection.onmessage;
        x(data);
      };
    });
    connection.sendString(JSON.stringify({
      method: 'command',
      params: {
        command,
        magicToken,
        noSideEffects: !!previewToken,
        env: process.env,
        dir: process.cwd(),
        aliases: getAliases(),
      }
    }));
    const id = ++this._shellId;
    this._shells.set(id, shell);
    this._notify('startTerminal', {id, previewToken});
    let waitForDoneCallback;
    const waitForDonePromise = new Promise(x => waitForDoneCallback = x);
    let last = '';
    const disposeDataListener = shell.onData(d => {
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
    });
    /** @type {{exitCode: number, died?: boolean, signal?: number, changes?: Changes}} */
    const returnValue = await Promise.race([
      new Promise(x => shell.onExit(value => {x({...value, died: true}); waitForDoneCallback()})),
      connectionDonePromise,
    ]);
    await waitForDonePromise;
    abortSignal?.removeEventListener('abort', abort);
    if (previewToken)
      this._abortControllers.delete(previewToken);
    this._shells.delete(id);
    if (this._freeShell) {
      if (!returnValue.died)
        shell.kill();
    } else if (!returnValue.died) {
      if (this._wroteToStdin.has(shell)) {
        // Don't reuse a shell if it had stdin written to it, because it might leak into the next command.
        // We could do something fancy to flush it out, but its probably easier to just leave it alone.
        const stdinEndToken = String(Math.random()) + '\n';
        await connectionDonePromise;
        connection.sendString(JSON.stringify({method: 'fush-stdin', params: {stdinEndToken}}));
        shell.write(stdinEndToken);
        const data = await new Promise(x => connection.onmessage = x);
        this._notify('leftoverStdin', {id, data, previewToken})
        shell.kill();
      } else {
        // This is where we reuse shells.
        disposeDataListener.dispose();
        this._freeShell = Promise.resolve({connection, shell});
      }
    }
    if (returnValue.changes && !previewToken) {
      const changes = returnValue.changes;
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

  async _getServerUrl() {
    if (!this._serverPromise)
      this._serverPromise = this._launchServer();
    return this._serverPromise;
  }

  async _launchServer() {
    const socketPath = path.join(this._socketDir, `${process.pid}-shell.sock`);
    const fs = require('fs');
    fs.mkdirSync(this._socketDir, {recursive: true, mode: 0o700});
    const net = require('net');
    try {fs.unlinkSync(socketPath); } catch {}
    const server = net.createServer();
    server.listen({
      path: socketPath,
    });
    process.on('exit', () => {
      server.close();
      try {fs.unlinkSync(socketPath);} catch {};
    });
    const uuid = require('crypto').randomUUID();
    await new Promise(x => server.once('listening', x));
    server.on('connection', async connection => {
      const transport = new (require('../protocol/pipeTransport').PipeTransport)(connection, connection);
      const message = await new Promise(x => transport.onmessage = x);
      if (message.uuid !== uuid) {
        console.error('invlid uuid', message.uuid, uuid);
        return;
      }
      const {id} = message;
      this._resolveShellConnection.get(id)(transport);
      this._resolveShellConnection.delete(id);
    });
    return {socketPath, uuid};
  }
}


module.exports = { Runtime }