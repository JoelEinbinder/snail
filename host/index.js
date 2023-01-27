
/**
 * @typedef {import('events').EventEmitter & {send: (message: any) => void}} Client
 */

const { ProtocolProxy } = require('./ProtocolProxy');
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
const handler = {
  /**
   * @param {Client} sender
   */
  async createJSShell({cwd, sshAddress, socketPath}, sender) {
    sender.on('destroyed', destroy);

    async function destroy() {
      sender.off('destroyed', destroy);
      await socketPromise;
      socket.onclose = null;
      proxies.delete(socketId);
      proxy.close();
    }
    const { spawnJSProcess } = require('../shell/spawnJSProcess');
    const socketPromise = spawnJSProcess({cwd, sshAddress, socketPath});
    const socket = await socketPromise;
    const socketId = ++lastWebsocketId;
    const proxy = new ProtocolProxy(socket, message => {
      sender.send({ method: 'websocket', params: { socketId, message }});
    });
    socket.onclose = () => {
      sender.send({ method: 'websocket-closed', params: {socketId}});
    }
    proxies.set(socketId, proxy);
    await new Promise(x => socket.onopen = x);
    return { socketId };
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
  async urlForIFrame({socketId, filePath}) {
    const address = await proxies.get(socketId).startOrGetServer(false);
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
  database = new sqlite3.Database(path.join(require('../path_service/').homedir(), '.terminal-history.sqlite3'));
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
