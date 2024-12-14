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
/** @type {import('@mistralai/mistralai').Mistral} */
let mistral;
/** @type {import('@anthropic-ai/sdk').Anthropic} */
let anthropic;
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
  /**
   * @param {{
   *   current: string,
   *   prefix: string,
   *   start: number,
   *   firstCommandId: number,
   *   direction: number,
   * }} params
   */
  async searchHistory(params, sender) {
    const {current, prefix, start, direction} = params;
    const max = (await handler.queryDatabase({
        sql: `SELECT MAX(command_id) FROM history`,
        params: [],
      }, sender))[0]['MAX(command_id)'];
    const maximumCommand = Math.min(params.firstCommandId, max + 1);
    const escapedPrefix = prefix.replace(/[\\%_]/g, '\\$&') + '%';
    if (direction === 1) {
      const result = await handler.queryDatabase({
          sql: `SELECT command_id, command, language FROM history WHERE command LIKE ? ESCAPE '\\' AND command_id < ? AND command != ? AND command_id < ? ORDER BY command_id DESC LIMIT 1`,
          params: [escapedPrefix, max - start + 1, current, maximumCommand],
        }, sender);
      if (result.length === 0)
        return 'end';
      return {
        command: result[0].command,
        language: result[0].language || 'shjs',
        historyIndex: max - result[0].command_id + 1,
      }
    } else {
      const result = await handler.queryDatabase({
          sql: `SELECT command_id, command, language FROM history WHERE command LIKE ? ESCAPE '\\' AND command_id > ? AND command != ? AND command_id < ? ORDER BY command_id ASC LIMIT 1`,
          params: [escapedPrefix, max - start + 1, current, maximumCommand],
        }, sender);
      if (result.length === 0)
        return 'current';
      return {
        command: result[0].command,
        language: result[0].language || 'shjs',
        historyIndex: max - result[0].command_id + 1,
      }
    }
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
  streamFromLLM({ apiKey, messages, model, system, tools, tool_choice }) {
    if (model.startsWith('gpt')) {
      if (!openai || openai.apiKey !== apiKey) {
        const { OpenAI } = require('openai');
        openai = new OpenAI({ apiKey });
      }
      messages.unshift({ role: 'system', content: system });
      const params = {
        model,
        messages,
        tools: tools && tools.map(tool => ({ function: tool, type: 'function'})),
        tool_choice: tool_choice && { function: { name: tool_choice }, type: 'function'},
        stream: true,
      };
      require('fs').appendFileSync('log.txt', JSON.stringify(params) + '\n');
      return openAIStreamToString(openai.chat.completions.create({
        model,
        messages,
        tools: tools && tools.map(tool => ({ function: tool, type: 'function'})),
        tool_choice: tool_choice && { function: { name: tool_choice }, type: 'function'},
        stream: true,
      }));
    } else if (model.startsWith('claude')) {
      if (!anthropic || anthropic.apiKey !== apiKey) {
        const { Anthropic } = require('@anthropic-ai/sdk');
        anthropic = new Anthropic({ apiKey });
      }
      messages.unshift({ role: 'user', content: 'Welcome to the terminal!'});
      for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'user')
          continue;
        if (messages[i+1]?.role === 'user')
          continue;
        messages.splice(i+1, 0, {content: '<empty response>', role: 'user'});
      }
      const stream = anthropic.messages.stream({
        model,
        system,
        messages,
        tools: tools && tools.map(tool => {
          return {
            name: tool.name,
            input_schema: tool.parameters,
            description: tool.description,
          };
        }),
        tool_choice: tool_choice && { name: tool_choice, type: 'tool' },
        max_tokens: 1024,
        stream: true,
      });
      return anthropicStreamToString(stream);
    }

    /**
     * @param {Promise<AsyncIterable<import('openai').OpenAI.ChatCompletionChunk>>} stream
     */
    async function * openAIStreamToString(stream) {
      const built_calls = [];
      for await (const chunk of await stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta)
          continue;
        const finish_reason = chunk.choices[0]?.finish_reason;
        if (delta.content)
          yield delta.content;
        if (delta.tool_calls) {
          for (const tool_call of delta.tool_calls) {
            if (!built_calls[tool_call.index])
              built_calls[tool_call.index] = { name: '', arguments: '' };
            if (tool_call.function.name)
              built_calls[tool_call.index].name = tool_call.function.name;
            if (tool_call.function.arguments)
              built_calls[tool_call.index].arguments += tool_call.function.arguments;
          }
        }
        if (finish_reason === 'tool_calls') {
          for (const call of built_calls) {
            const args = JSON.parse(call.arguments);
            const name = call.name;
            yield { name, args };
          }
          built_calls.length = 0;
        }
      }
    }
    /**
     * @param {AsyncIterable<import('@anthropic-ai/sdk').Anthropic.MessageStreamEvent>} stream
     */
    async function * anthropicStreamToString(stream) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_start')
          yield chunk.content_block.text
        else if (chunk.type === 'content_block_delta')
          yield chunk.delta.text;
        else
          yield '';
      }
    }
  },
  fillWithLLM({ apiKey, model, prompt, suffix }) {
    if (!mistral || mistral.apiKey !== apiKey) {
      const { Mistral } = require('@mistralai/mistralai');
      mistral = new Mistral({ apiKey, serverURL: 'https://codestral.mistral.ai' });
    }
    const stop = ['\n\n', '\r\n\r\n', '```'];
    // mistral is bad at hadning suffixes. So only do one line if there is a suffix.
    if (suffix.trim().length) {
      stop.push('\n');
    }
    return mistralStreamToString(mistral.fim.stream({
      model,
      prompt,
      suffix,
      maxTokens: 128,
      stop,
    }));

    /**
     * @param {ReturnType<import('@mistralai/mistralai').Mistral['fim']['stream']>} stream
     */
    async function * mistralStreamToString(stream) {
      for await (const chunk of await stream) {
        console.log(chunk.data.choices);
        yield chunk.data.choices[0]?.delta.content || '';
      }
    }
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
