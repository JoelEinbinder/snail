
/**
 * @typedef {import('events').EventEmitter & {send: (message: any) => void}} Client
 */
/**
 * @typedef {Object} FetchResponse
 * @property {string=} data
 * @property {string=} mimeType
 * @property {number} statusCode
 * @property {Record<string, string|string[]>=} headers
 */
let lastShellId = 0;
/** @type {Map<number, import('../shell/shell').Shell>} */
const shells = new Map();
let lastWebsocketId = 0;
/** @type {Map<number, {send: (message:string) => void, close: () => void, onmessage?: (event: {data: string}, onopen?: () => void) => void}>} */
const websockets = new Map();
const handler = {
  async evaluate({shellId, code}) {
    return shells.get(shellId).evaluate(code);
  },
  async chdir({shellId, dir}) {
    return shells.get(shellId).chdir(dir);
  },
  async env({shellId, env}) {
    return shells.get(shellId).env(env);
  },
  /**
   * @param {Client} sender
   */
  async createShell({sshAddress}, sender) {
    const shellId = ++lastShellId;
    const shell = new (require('../shell/shell').Shell)(sshAddress);
    shells.set(shellId, shell);
    sender.on('destroyed', destroy);

    function destroy() {
      sender.off('destroyed', destroy);
      shells.get(shellId).close();
      shells.delete(shellId);
    }

    return {shellId};
  },
  /**
   * @param {Client} sender
   */
  async createJSShell({cwd, sshAddress}, sender) {
    /** @type {import('child_process').ChildProcessWithoutNullStreams} */
    let child;
    let killed = false;
    sender.on('destroyed', destroy);

    function destroy() {
      killed = true;
      sender.off('destroyed', destroy);
      websockets.delete(socketId);
      child?.kill();
    }
    const { spawnJSProcess } = require('../shell/spawnJSProcess');
    const result = await spawnJSProcess(cwd, sshAddress);
    child = result.child;
    if (killed)
      child.kill();
    const socketId = ++lastWebsocketId;
    const socket = result.socket;
    socket.onmessage = event => {
      sender.send({ method: 'websocket', params: {socketId, message: event.data}});
    };
    websockets.set(socketId, socket);
    await new Promise(x => socket.onopen = x);
    return { socketId };
  },
  sendMessageToWebSocket({socketId, message}) {
    websockets.get(socketId).send(message);
  },
  destroyWebsocket({socketId}) {
    websockets.get(socketId).close();
    websockets.delete(socketId);
  },
  async getHistory() {
    const util = require('util');
    const database = await getDatabase();
    return await util.promisify(database.all.bind(database))('SELECT command FROM history ORDER BY command_id ASC');
  },
  async addHistory(item) {
    const database = await getDatabase();
    const runResult = await new Promise((res, rej) => {
      database.run(`INSERT INTO history (command, start) VALUES (?, ?)`, [item.command, item.start], function (err) {
        if (err)
          rej(err)
        else
          res(this);
      });
    });
    return runResult.lastID;;
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
  async urlForIFrame({shellId, filePath}) {
    const address = await shells.get(shellId).startOrGetServer();
    const url = new URL(`http://localhost:${address.port}`);
    url.pathname = filePath;
    url.search = '?entry';
    return url.href;
  }
}

let database;
/** @return {Promise<import('sqlite3').Database>} */
async function getDatabase() {
  if (database)
    return database;
  const path = require('path');
  const sqlite3 = require('sqlite3');
  database = new sqlite3.Database(path.join(__dirname, '..', 'history.sqlite3'));
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
  return database;
}

module.exports = {handler};