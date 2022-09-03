
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
  async aliases({shellId, aliases}) {
    return shells.get(shellId).aliases(aliases);
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
      socket.onmessage = null;
      socket.onclose = null;
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
    socket.onclose = () => {
      sender.send({ method: 'websocket-closed', params: {socketId}});
    }
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
  async urlForIFrame({shellId, filePath}) {
    const address = await shells.get(shellId).startOrGetServer(false);
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
  database = new sqlite3.Database(path.join(require('os').homedir(), '.terminal-history.sqlite3'));
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

module.exports = {handler, shells};
