const inspector = require('inspector');
const net = require('net');
const fs = require('fs');
const {PipeTransport} = require('../protocol/pipeTransport');
const pathService = require('../path_service/');
const path = require('path');
const worker_threads = require('node:worker_threads');
const { ShellState } = require('./ShellState');
const socketDir = path.join(pathService.tmpdir(), 'snail-sockets');
const socketPath = path.join(socketDir, `${process.pid}.socket`);
const metadataPath = path.join(socketDir, `${process.pid}.json`);
/** @type {import('./metadata').Metadata} */
const metadata = {
  connected: false,
  socketPath,
};
const shellState = new ShellState();
let isDaemon = false;
const enabledTransports = new Set();
/** @type {Set<string>} */
const retainers = new Set();
let objectIdPromise;
let lastCommandPromise;
let lastSubshellId = 0;
let lastAskPassId = 0;
let lastStreamId = 0;
let lastPreviewToken = 0;
/** @type {Map<number, any[]>} */
const previewResults = new Map();
/** @type {Map<number, (password: string) => void>} */
const passwordCallbacks = new Map();
/** @type {Map<number, import('../protocol/ProtocolProxy').ProtocolProxy>} */
const subshells = new Map();
/** @typedef {import('../../src/JSConnection').ExtraClientMethods} ShellHandler */
/** @type {{[key in keyof ShellHandler]: (params: Parameters<ShellHandler[key]>[0], signal: AbortSignal) => (Promise<ReturnType<ShellHandler[key]>>)}} */
const handler = {
  'Shell.setIsDaemon': async (params) => {
    isDaemon = !!params.isDaemon;
    if (isDaemon)
      retainers.add('daemon mode');
    else
      retainers.delete('daemon mode');
    maybeExit(); // can never actually exit here beacuse the connection is still open
    for (const transport of enabledTransports)
      transport.send({method: 'Shell.daemonStatus', params: {isDaemon}});
  },
  'Shell.enable': async (params) => {
    enabledTransports.add(transport);
    transport.send({method: 'Shell.daemonStatus', params: {isDaemon}});
    if (!objectIdPromise)
      objectIdPromise = initObjectId(params);
    return {objectId: await objectIdPromise};
  },
  'Shell.disable': async (params) => {
    enabledTransports.delete(transport);
  },
  'Shell.evaluate': async (params) => {
    const {getResult} = require('../shjs/index');
    const {output, code} = await getResult(params.code);
    return { result: output, exitCode: code };
  },
  'Shell.evaluateStreaming': async (params) => {
    const streamId = ++lastStreamId;
    const { code } = params;
    const { execute } = require('../shjs/index');
    const { Writable } = require('stream');
    // make sure the streamId is sent before any evaluateStreamData comes in.
    setTimeout(async () => {
      const { closePromise, kill, stdin } = execute(code, new Writable({
        write(chunk, encoding, callback) {
          transport?.send({ method: 'Shell.evaluateStreamingData', params: {streamId, data: chunk.toString()}});
          callback();
        }
      }));
      await closePromise;
      transport?.send({ method: 'Shell.evaluateStreamingEnd', params: {streamId}});
    }, 0);
    return { streamId };
  },
  'Shell.restore': async () => {
    const senderTransport = transport;
    const result = await lastCommandPromise;
    if (transport === senderTransport) {
      clearStoredMessages();
      retainers.delete('witness me');
      maybeExit(); // can never actually exit here because the connection is still open
    }
    return result;
  },
  'Shell.runCommand': async ({expression, command}) => {
    retainers.add('runCommand');
    lastCommandPromise = send('Runtime.evaluate', {
      expression,
      returnByValue: false,
      generatePreview: true,
      userGesture: true,
      replMode: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    /** @type {import('./metadata').Task} */
    const task = {
      command,
      started: Date.now(),
    };
    metadata.task = task;
    writeMetadata();
    const senderTransport = transport;
    const result = await lastCommandPromise;
    task.ended = Date.now();
    writeMetadata();
    retainers.add('witness me');
    if (senderTransport === transport) {
      clearStoredMessages();
      retainers.delete('witness me');
      maybeExit(); // can never actually exit here because the connection is still open
    } else if (!transport) {
      // nobody is connected, so maybe send a notification
      const request = require('http').request('http://Joels-Mac-mini.local:26394/notify', {
        method: 'POST',
      });
      request.end(JSON.stringify({
        "aps" : {
           "alert" : {
              "title" : "Task Completed",
              "body" : command
           },
           "sound" : "correct.wav",
        },
        location: {
          username: require('os').userInfo().username,
          hostname: require('os').hostname(),
          socketPath,
        }
      }));
    }
    retainers.delete('runCommand');
    maybeExit(); // can never actually exit here because the connection is still open or we haven't been witnessed
    return result;
  },
  'Shell.previewCommand': async ({command}, signal) => {
    const previewToken = ++lastPreviewToken;
    const notifications = [];
    const abort = () => send('Runtime.evaluate', {
      expression: `global._abortPty(${JSON.stringify(previewToken)})`,
      returnByValue: true,
      generatePreview: false,
    }).catch(e => e);
    signal.addEventListener('abort', abort);
    previewResults.set(previewToken, notifications);
    const result = await send('Runtime.evaluate', {
      expression: `await global.pty(${JSON.stringify(command)}, ${JSON.stringify(previewToken)})`,
      returnByValue: false,
      generatePreview: true,
      userGesture: true,
      replMode: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    signal.removeEventListener('abort', abort);
    previewResults.delete(previewToken);
    return {result, notifications};
  },
  'Shell.resolveFileForIframe': async (params) => {
    if (params.shellIds.length) {
      const subshellId = params.shellIds.shift();
      const subshell = subshells.get(subshellId);
      const out = await subshell.send('Shell.resolveFileForIframe', params);
      if (out.error) {
        return {
          response: { statusCode: 500, data: Buffer.from(new TextEncoder().encode(out.error.message)).toString('base64') },
        }
      } else {
        return out.result;
      }
    }
    const response = await require('./webserver').resolveFileForIframe(params);
    return {response};
  },
  'Shell.createSubshell': async params => {

    const { ProtocolProxy } = require('../protocol/ProtocolProxy');

    const id = ++lastSubshellId;
    let startedTerminal = false;
    let endedTerminal = false;
    /** @type {Awaited<ReturnType<import('./createSSHSubshell')['createSSHSubshell']>>} */
    let output;
    if ('sshAddress' in params) {
      const {sshAddress, sshArgs, env} = params;
      const { createSSHSubshell } = require('./createSSHSubshell');
      output = await createSSHSubshell({
        sshAddress, sshArgs, env,
        askPass: async data => {      
          const id = ++lastAskPassId;
          transport.send({method: 'Shell.askPassword', params: {id: lastAskPassId, message: data.message}});
          return await new Promise(x => passwordCallbacks.set(id, x));
        },
        onclose: () => transport?.send({method: 'Shell.subshellDestroyed', params: { id }}),
        ondata: data => {
          if (endedTerminal)
            return;
          if (!startedTerminal) {
            transport.send({method: 'Shell.notify', params: { payload: {method: 'startTerminal', params: {id: -1}}}});
            startedTerminal = true;
          }
          transport.send({method: 'Shell.notify', params: { payload: {method: 'data', params: {id: -1, data: String(data).replaceAll('\n', '\r\n')}}}});
        },
      });
    } else {
      const { connectToSocket } = require('./spawnJSProcess');
      const socket = await connectToSocket(params.socketPath);
      output = {
        socket,
        closePromise: new Promise(x => socket.onclose = x),
        getExitCode: () => null,
      };
      socket.onclose = () => transport?.send({method: 'Shell.subshellDestroyed', params: { id }});
    }

    const {socket, closePromise, getExitCode} = output;
    const proxy = new ProtocolProxy(socket, message => {
      // TODO what to do when the transport has changed or is gone??
      transport?.send({method: 'Shell.messageFromSubshell', params: { id, message }})
    });
    subshells.set(id, proxy);
    await Promise.race([
      socket.readyPromise,
      closePromise,
    ]);
    if (startedTerminal)
      transport.send({method: 'Shell.notify', params: { payload: {method: 'endTerminal', params: {id: -1}}}});
    endedTerminal = true;
    if (getExitCode() !== null)
      return { exitCode: getExitCode() };
    return { id };
  },
  'Shell.sendMessageToSubshell': async ({id, message}) => {
    const response = await subshells.get(id).send(message.method, message.params);
    if (!message.id)
      return;
    response.id = message.id;
    transport?.send({method: 'Shell.messageFromSubshell', params: { id, message: response }})
  },
  'Shell.destroySubshell': async ({id}) => {
    subshells.get(id)?.close();
  },
  'Shell.providePassword': async ({id, password}) => {
    passwordCallbacks.get(id)(password);
    passwordCallbacks.delete(id);
  },
  'Shell.kill': async () => {
    process.exit(0);
  },
  'Protocol.abort': async(params) => {
    abortControllers.get(transport)?.get(params.id)?.abort();
  },
  'Shell.setCwd': async({cwd}) => {
    shellState.setCwd(cwd, message => transport?.send(message));
    await send('Runtime.evaluate', {
      expression: `process.chdir(${JSON.stringify(cwd)})`,
      returnByValue: true,
    });
  },
  // @ts-ignore
  __proto__: null,
};

function clearStoredMessages() {
  lastCommandPromise = null;
  shellState.clear();
}

/** @type {WeakMap<PipeTransport, Map<number, AbortController>>} */
const abortControllers = new WeakMap();

async function dispatchToHandler(message, replyTransport) {
  const abort = new AbortController();
  if (!abortControllers.has(transport))
    abortControllers.set(transport, new Map());
  if ('id' in message) {
    abortControllers.get(transport).set(message.id, abort);
  }
  try {
    const result = await handler[message.method](message.params, abort.signal);
    if (replyTransport !== transport)
      return;
    if ('id' in message)
      transport.send({id: message.id, result});
  } catch(e) {
    if (replyTransport !== transport)
      return;
    if ('id' in message)
      transport.send({id: message.id, error: {message: String(e.stack)}});
  }
  if ('id' in message)
    abortControllers.get(transport).delete(message.id);
}
/** @type {PipeTransport|null} */
let transport = null;
let detached = true;
function waitForConnection() {
  const unixSocketServer = net.createServer();
  unixSocketServer.listen({
    path: socketPath,
  });
  unixSocketServer.on('connection', (s) => {
    detached = false;
    retainers.add('connected transport');
    fs.unlinkSync(socketPath);
    transport = new PipeTransport(s, s);
    metadata.connected = true;
    writeMetadata();
    transport.onmessage = (/** @type {import('../protocol/pipeTransport').ProtocolRequest} */ message) => {
      if (message.method in handler) {
        dispatchToHandler(message, transport);
        return;
      }
      let callback = 'id' in message ? (error, result) => {
        if (error)
          transport?.send({id: message.id, error});
        else
          transport?.send({id: message.id, result});
      } : undefined;
      session.post(message.method, message.params, callback);
    };
    s.on('close', () => {
      enabledTransports.delete(transport);
      transport = null;
      metadata.connected = false;
      writeMetadata();  

      retainers.delete('connected transport');
      maybeExit();

      waitForConnection();
    });
    shellState.restore(message => transport.send(message));
  });
}
process.on('exit', () => {
  if (detached)
    try {fs.unlinkSync(socketPath); } catch {}
  try {fs.unlinkSync(metadataPath); } catch {}
})

const session = new inspector.Session();
session.connectToMainThread();
session.on('inspectorNotification', (/** @type {{method: string, params: any}} */ notification) => {
  if (notification.method === 'Runtime.bindingCalled' && notification.params.name === 'magic_binding') {
    const {method, params} = JSON.parse(notification.params.payload);
    if (method === 'env') {
      for (const key in params)
        process.env[key] = params[key];
    }
    if (method === 'aliases') {
      const {setAlias} = require('../shjs/index');
      for (const key of Object.keys(params)) {
        setAlias(key, params[key]);
      }
    }

    if (method === 'cwd') {
      shellState.setCwd(params, message => transport?.send(message));
    } else {
      if (params.previewToken) {
        const notifications = previewResults.get(params.previewToken);
        if (notifications)
          notifications.push({method, params});
      } else {
        const message = {
          method: 'Shell.notify',
          params: {
            payload: {method, params}
          }
        };
        transport?.send(message);
        shellState.addMessage(message);
      }
    }
    return;
  }
  transport?.send(notification);
  shellState.addMessage(notification);
});

/**
 * @template {keyof import('../../src/protocol').Protocol.CommandParameters} T
 * @param {T} method
 * @param {import('../../src/protocol').Protocol.CommandParameters[T]} params
 * @returns {Promise<import('../../src/protocol').Protocol.CommandReturnValues[T]>}
 */
async function send(method, params) {
  return new Promise((resolve, reject) => {
    session.post(method, params, (err, res) => err ? reject(err) : resolve(/** @type {any} */ (res)));
  });
}

async function initObjectId({args}) {
  await send('Runtime.enable', {});
  await send('Runtime.addBinding', {
    name: 'magic_binding',
  });
  const {result: {objectId}} = await send('Runtime.evaluate', {
    expression: `bootstrap(${JSON.stringify(args)})`,
    returnByValue: false,
  });

  if (args.length) {
    const file = args[0];
    const expression = await fs.promises.readFile(file, 'utf8');
    await send('Runtime.evaluate', {
      expression,
      replMode: true,
    });
  } else {
    const sourceCode = await fs.promises.readFile(path.join(pathService.homedir(), '.bootstrap.shjs'), 'utf8').catch(e => null);
    if (typeof sourceCode === 'string') {
      const expression = await transformCode(sourceCode);
      await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        generatePreview: false,
        userGesture: false,
        replMode: true,
        allowUnsafeEvalBlockedByCSP: true,
      });
    }
  }
  return objectId;
}
async function transformCode(code) {
  const { transformCode } = require('../shjs/transform');
  const jsCode = transformCode(code, 'global.pty', await globalVars());
  return jsCode;
}

async function globalVars() {
  const {names} = await send('Runtime.globalLexicalScopeNames', {});
  const {result} = await send('Runtime.getProperties', {
    objectId: await globalObjectId(),
    generatePreview: false,
    ownProperties: false,
    accessorPropertiesOnly: false,
  });
  const globalNames = result.filter(x => !x.symbol).map(x => x.name);
  return new Set(names.concat(globalNames));
}

async function globalObjectId() {
  const {result: {objectId}} = await send('Runtime.evaluate', {
    expression: '(function() {return this})()',
    returnByValue: false,
  });
  return objectId;
}

let metadataLock = null;
async function writeMetadata() {
  while (metadataLock) {
    await metadataLock;
  }
  const lock = fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), {
    mode: 0o600,
  });
  metadataLock = lock;
  await metadataLock;
  if (metadataLock === lock)
    metadataLock = null;
}

function maybeExit() {
  if (retainers.size)
    return;
  process.exit(0);
}
writeMetadata();
waitForConnection();
