//@ts-check

// Creating the shell can be a bit slow, so we do it in advance.
// Then once the web app requests a shell, there is one hot and ready
// for it.

const path = require('path');
const fs = require('fs');
const { ProtocolProxy } = require('../slug/protocol/ProtocolProxy');
const pathService = require('../slug/path_service/');

let existingShell = null;
/**
 * @return {ReturnType<typeof createJSShell>}
 */
function getOrCreateJSShell() {
  if (!existingShell)
    return createJSShell();
  const myShell = existingShell;
  existingShell = null;
  return myShell;
}

function preloadJSShell() {
  if (existingShell)
    return;
  existingShell = createJSShell();
}

function createJSShell() {
  let resolveProxy;
  /** @type {Promise<ProtocolProxy>} */
  const proxyPromise = new Promise(x => resolveProxy = x);
  let websocketBuffer = [];
  let didClose = false;
  let onwebsocket = message => {
    websocketBuffer.push(message);
  };
  let onclose = () => {};
  const init = async () => {
    let startedTerminal = false;
    let endedTerminal = false;
    /** @type {(data: Buffer) => void} */
    const onErrData = data => {
      if (endedTerminal)
        return;
      if (!startedTerminal) {
        onwebsocket({
          method: 'Shell.notify',
          params: { payload: {method: 'startTerminal', params: {id: -1}}}
        });
        startedTerminal = true;
      }
      onwebsocket({
        method: 'Shell.notify',
        params: { payload: {method: 'data', params: {id: -1, data: String(data).replaceAll('\n', '\r\n')}}}
      });
    }
    const { bootstrapPath, nodePath } = await (async () => {
      const localPath = path.join(__dirname, '..', 'slug', 'shell', 'bootstrap.js');
      if (!process.env.SNAIL_FORCE_NO_LOCAL && fs.existsSync(localPath)) {
        return {
          nodePath: process.execPath.endsWith('node') ? process.execPath : 'node',
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
            SNAIL_NODE_URL: process.env.SNAIL_NODE_URL || 'https://nodejs.org/dist',
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
      cwd: null,
      nodePath,
      bootstrapPath,
    });
    err?.on('data', onErrData);
    const socket = await socketPromise;
    endedTerminal = true;
    if (startedTerminal) {
      onwebsocket({
        method: 'Shell.notify',
        params: { payload: {method: 'endTerminal', params: {id: -1}}}
      });
    }
    const proxy = new ProtocolProxy(socket, message => {
      onwebsocket(message);
    });
    resolveProxy(proxy);
    socket.onclose = () => {
      didClose = true;
      onclose();
    }
    await socket.readyPromise;
  };
  const startupPromise = init();
  return {
    startupPromise,
    proxyPromise,
    adopt(_onwebsocket, _onclose) {
      onwebsocket = _onwebsocket;
      onclose = _onclose;
      websocketBuffer.forEach(onwebsocket);
      websocketBuffer = [];
      if (didClose)
        onclose();
    },
    dispose() {
      onclose = () => {};
    }
  }
}

module.exports = { preloadJSShell, getOrCreateJSShell };
