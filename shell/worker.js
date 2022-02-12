//@ts-check
const {PipeTransport} = require('../protocol/pipeTransport');
const {RPC} = require('../protocol/rpc');
const path = require('path');
const transport = new PipeTransport(process.stdout, process.stdin);
const magicToken = String(Math.random());
const magicString = `\x33[JOELMAGIC${Math.random()}]\r\n`;
/** @type {Promise<{exitCode: number, signal?: number}>} */
let commandQueue = Promise.resolve({exitCode: 0});
/** @type {import('node-pty').IPty} */
let shell;
let rows = 24;
let cols = 80;
let env = {...process.env};
let cwd = process.cwd();

const rpc = RPC(transport, {
  /** @param {{rows: number, cols: number}} size */
  resize(size) {
    rows = size.rows;
    cols = size.cols;
    if (shell)
      shell.resize(cols, rows);
  },
  /** @param {string} code */
  async evaluate(code) {
    const {getResult} = require('../shjs/index');
    const {output} = await getResult(code);
    return output;
  },
  /** @param {string} input */
  sendRawInput(input) {
    if (shell)
      shell.write(input);
  },
  /**
   * @param {string} command
   */
  async runCommand(command) {
    return commandQueue = commandQueue.then(() => runCommand(command));
  }
});


/**
 * @param {string} command
 */
async function runCommand(command) {
  shell = require('node-pty').spawn('node', [path.join(__dirname, '..', 'shjs', 'wrapper.js'), command, magicToken], {
    env,
    rows,
    cols,
    cwd,
    name: 'xterm-256color',
    handleFlowControl: true,
    encoding: null,
  });
  let extraData = '';
  let inExtraData = false;
  shell.onData(d => {
    let data = d.toString();
    if (!inExtraData && data.slice(data.length - magicString.length).toString() === magicString) {
      data = data.slice(0, -magicString.length);
      inExtraData = true;
    }
    if (inExtraData)
      extraData += data;
    else
      rpc.notify('data', data);
  });
  /** @type {{exitCode: number, signal?: number}} */
  const returnValue = await new Promise(x => shell.onExit(x));
  shell = null;
  if (extraData.length) {
    const changes = JSON.parse(extraData);
    if (changes.cwd) {
      cwd = changes.cwd;
      process.chdir(cwd);
      rpc.notify('cwd', changes.cwd);
    }
    if (changes.env) {
      for (const key in changes.env) {
        env[key] = changes.env[key];
        process.env[key] = changes.env[key];
      }
      rpc.notify('env', changes.env);
    }
  }
  return returnValue;
}