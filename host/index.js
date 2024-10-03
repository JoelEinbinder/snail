/**
 * @typedef {import('events').EventEmitter & {send: (message: any) => void}} Client
 */

const { ProtocolProxy } = require('../slug/protocol/ProtocolProxy');
const { WebServers } = require('../host/WebServers');
const { getOrCreateJSShell, preloadJSShell } = require('./preloadJSShell');
// expect at least one shell to get created
preloadJSShell();
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
/** @type {import('openai').OpenAI} */
let openai;
/** @typedef {import('./ShellHost').ShellHost} ShellHost */
/** @type {{[key in keyof ShellHost]: (params: Parameters<ShellHost[key]>[0], sender: Client) => Promise<ReturnType<ShellHost[key]>>}} */
const handler = {
  async obtainWebSocketId() {
    return ++lastWebsocketId;
  },
  async createJSShell({cwd, socketId}, sender) {
    if (proxies.has(socketId))
      throw new Error('Socket already exists');
    sender.on('destroyed', destroy);

    async function destroy() {
      sender.off('destroyed', destroy);
      const proxy = await proxyPromise;
      dispose();
      proxies.delete(socketId);
      proxy.close();
    }
  
    const { adopt, dispose, proxyPromise, startupPromise } = getOrCreateJSShell();
    adopt(message => {
      sender.send({ method: 'websocket', params: { socketId, message }});
    }, () => {
      sender.send({ method: 'websocket-closed', params: {socketId}});
    });
    const proxy = await proxyPromise;
    proxies.set(socketId, proxy);
    await startupPromise;
    if (cwd)
      proxy.notify('Shell.setCwd', { cwd })
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
      database.run(`INSERT INTO history (command, start, language) VALUES (?, ?, ?)`, [item.command, item.start, item.language], function (err) {
        if (err)
          rej(err)
        else
          res(this);
      });
    });
    return runResult.lastID;
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
  },
  reportTime({ name }) {
    if (parseInt(process.env.SNAIL_TIME_STARTUP))
      console.log(`Time: ${name}`);
  },
  openai(request){
    if (!openai || openai.apiKey !== request.apiKey) {
      const { OpenAI } = require('openai');
      openai = new OpenAI({
        apiKey: request.apiKey,
      });
    }
    return openai.chat.completions.create({
      ...request,
      apiKey: undefined,
    });
  },
}

async function getTheme() {
  const database = await getDatabase();
  const getResult = await new Promise((res, rej) => {
    database.get(`SELECT value FROM preferences WHERE key = ?`, 'theme', function(err, row) {
      if (err)
        rej(err);
      else
        res(row);
    });
  });
  if (!getResult || !getResult.value)
    return 'dark';
  return JSON.parse(getResult.value);
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
    language TEXT,
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
  // this will fail if the column already exists, but it doesn't throw an error
  await new Promise(x => database.run(`ALTER TABLE history ADD COLUMN language TEXT`, x))
  await new Promise(x => database.run(`CREATE TABLE IF NOT EXISTS preferences (
    key TEXT PRIMARY KEY,
    value TEXT
  )`, x));
  return database;
}

module.exports = {handler, proxies, preloadJSShell, getTheme};
