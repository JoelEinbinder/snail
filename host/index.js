
/**
 * @typedef {import('events').EventEmitter & {send: (message: any) => void}} Client
 */

const { ProtocolProxy } = require('../slug/protocol/ProtocolProxy');
const pathService = require('../slug/path_service/');
const { WebServers } = require('../host/WebServers');
const path = require('path');
const fs = require('fs');

/**
 * @typedef {Object} FetchResponse
 * @property {string=} data
 * @property {string=} mimeType
 * @property {number} statusCode
 * @property {Record<string, string|string[]>=} headers
 */
let lastWebsocketId = 0;
/** @type {Map<number, ProtocolProxy>} */
const proxies = new Map();
const webServers = new WebServers(false);
const handler = {
  async obtainWebSocketId() {
    return ++lastWebsocketId;
  },
  /**
   * @param {Client} sender
   */
  async createJSShell({cwd, socketId}, sender) {
    if (proxies.has(socketId))
      throw new Error('Socket already exists');
    sender.on('destroyed', destroy);

    async function destroy() {
      sender.off('destroyed', destroy);
      await socketPromise;
      socket.onclose = null;
      proxies.delete(socketId);
      proxy.close();
    }

    // const execute = [
    //   `SNAIL_VERSION=${JSON.stringify(require('../package.json').version)}`,
    //   `SNAIL_SLUGS_URL=${shellescape(delegate.env.SNAIL_SLUGS_URL || 'https://joel.tools/slugs')}`,
    //   `sh -c ${shellescape(fs.readFileSync(path.join(__dirname, './download-slug-if-needed-and-run.sh'), 'utf8'))}`,
    // ].join(' ');
    // const child = spawn('ssh', [...delegate.sshArgs, delegate.sshAddress, execute], {
    //   stdio: ['pipe', 'pipe', 'pipe'],
    //   detached: false,
    //   cwd: process.cwd(),
    //   env: {
    //     ...delegate.env,
    //     PWD: process.cwd(),
    //     SSH_ASKPASS: path.join(__dirname, './sshAskpass.js'),
    //     SNAIL_SSH_PASS_SOCKET: sshPassSocketPath,
    //     SSH_ASKPASS_REQUIRE: 'force',
    //   }
    // });
  
    let startedTerminal = false;
    let endedTerminal = false;
    /** @type {(data: Buffer) => void} */
    const onErrData = data => {
      if (endedTerminal)
        return;
      if (!startedTerminal) {
        sender.send({ method: 'websocket', params: { socketId, message: {
          method: 'Shell.notify',
          params: { payload: {method: 'startTerminal', params: {id: -1}}}
        }}});
        startedTerminal = true;
      }
      sender.send({ method: 'websocket', params: { socketId, message: {
        method: 'Shell.notify',
        params: { payload: {method: 'data', params: {id: -1, data: String(data).replaceAll('\n', '\r\n')}}}
      }}});
    }
    const { bootstrapPath, nodePath } = await (async () => {
      const localPath = path.join(__dirname, '..', 'slug', 'shell', 'bootstrap.js');
      if (!process.env.SNAIL_FORCE_NO_LOCAL && fs.existsSync(path.join(__dirname, ))) {
        return {
          nodePath: process.execPath.endsWith('node') ? process.execPath : '/usr/local/bin/node',
          bootstrapPath: localPath,
        }
      }
      const slugPath = path.join(pathService.homedir(), '.snail', require('../package.json').version);
      const nodePath = path.join(slugPath, 'node', 'bin', 'node');  
      if (!fs.existsSync(nodePath)) {
        const { spawn } = require('child_process');
        const child = spawn('sh', [path.join(__dirname, '..', 'slug', 'shell', './download-slug-if-needed-and-run.sh')], {
          stdio: ['ignore', 'ignore', 'pipe'],
          cwd: pathService.homedir(),
          env: {
            ...process.env,
            SNAIL_VERSION: require('../package.json').version,
            SNAIL_SLUGS_URL: process.env.SNAIL_SLUGS_URL || 'https://joel.tools/slugs',
            SNAIL_DONT_RUN: '1',
          },
        });
        child.stderr.on('data', onErrData);
        await new Promise(x => child.on('exit', x));
        if (child.exitCode !== 0)
          throw new Error('Failed to download slug');
      }
      return {
        nodePath,
        bootstrapPath: path.join(slugPath, 'shell', 'bootstrap.js'),
      }
    })();
    const { spawnJSProcess } = require('../slug/shell/spawnJSProcess');
    const {socketPromise, err} = spawnJSProcess({
      cwd,
      nodePath,
      bootstrapPath,
    });
    err?.on('data', onErrData);
    const socket = await socketPromise;
    endedTerminal = true;
    if (startedTerminal) {
      sender.send({ method: 'websocket', params: { socketId, message: {
        method: 'Shell.notify',
        params: { payload: {method: 'endTerminal', params: {id: -1}}}
      }}});
    }
    const proxy = new ProtocolProxy(socket, message => {
      sender.send({ method: 'websocket', params: { socketId, message }});
    });
    socket.onclose = () => {
      sender.send({ method: 'websocket-closed', params: {socketId}});
    }
    proxies.set(socketId, proxy);
    await new Promise(x => socket.onopen = x);
  },
  async sendMessageToWebSocket({socketId, message}, sender) {
    const response = await proxies.get(socketId).send(message.method, message.params);
    if (!message.id)
      return;
    response.id = message.id;
    sender.send({ method: 'websocket', params: { socketId, message: response }});
  },
  destroyWebsocket({socketId}) {
    proxies.get(socketId).close();
    proxies.delete(socketId);
  },
  async addHistory(item) {
    const database = await getDatabase();
    const runResult = await new Promise((res, rej) => {
      database.run(`INSERT INTO history (command, start, pwd) VALUES (?, ?, ?)`, [item.command, item.start, item.pwd], function (err) {
        if (err)
          rej(err)
        else
          res(this);
      });
    });
    return runResult.lastID;;
  },
  async queryDatabase({sql, params}) {
    const database = await getDatabase();
    const result = await new Promise((res, rej) => {
      database.all(sql, params, function(err, rows) {
        if (err)
          rej(err)
        else
          res(rows);
      })
    });
    return result;
  },
  async updateHistory({id, col, value}) {
    const database = await getDatabase();
    const runResult = await new Promise((res, rej) => {
      database.run(`UPDATE history SET '${col}' = ? WHERE command_id = ?`, [value, id], function (err) {
        if (err)
          rej(err)
        else
          res(this);
      });
    });
    return runResult.changes;
  },
  async urlForIFrame({shellIds, filePath}) {
    const [socketId] = shellIds;
    const address = await webServers.ensureServer(proxies.get(socketId));
    const url = new URL(`http://localhost:${address.port}`);
    url.pathname = filePath;
    url.search = '?entry';
    return url.href;
  },
  async saveItem({key, value}) {
    const database = await getDatabase();
    const runResult = await new Promise((res, rej) => {
      database.run(`INSERT INTO
        preferences(key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value=excluded.value`, [key, JSON.stringify(value)], function(err) {
        if (err)
          rej(err);
        else
          res(this);
      });
    });
    return runResult.changes;
  },
  async loadItem({key}) {
    const database = await getDatabase();
    const getResult = await new Promise((res, rej) => {
      database.get(`SELECT value FROM preferences WHERE key = ?`, key, function(err, row) {
        if (err)
          rej(err);
        else
          res(row);
      });
    });
    if (!getResult || !getResult.value)
      return undefined;
    return JSON.parse(getResult.value);
  }
}

let database;
/** @return {Promise<import('sqlite3').Database>} */
async function getDatabase() {
  if (database)
    return database;
  const path = require('path');
  const sqlite3 = require('sqlite3');
  database = new sqlite3.Database(path.join(require('../slug/path_service').homedir(), '.terminal-history.sqlite3'));
  await new Promise(x => database.run(`CREATE TABLE IF NOT EXISTS history (
    command_id INTEGER PRIMARY KEY AUTOINCREMENT,
    start INTEGER,
    end INTEGER,
    command TEXT,
    output TEXT,
    git_hash TEXT,
    git_branch TEXT,
    git_dirty TEXT,
    git_diff TEXT,
    pwd TEXT,
    home TEXT,
    username TEXT,
    hostname TEXT,
    exit_code INTEGER
  )`, x));
  await new Promise(x => database.run(`CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT
  )`, x));
  return database;
}

module.exports = {handler, proxies};
