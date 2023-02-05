const inspector = require('inspector');
const net = require('net');
const fs = require('fs');
const {PipeTransport} = require('../protocol/pipeTransport');
const pathService = require('../path_service/');
const path = require('path');
const worker_threads = require('node:worker_threads');
const { ShellState } = require('./ShellState');
const socketDir = path.join(pathService.tmpdir(), '1d4-sockets');
const socketPath = path.join(socketDir, `${process.pid}.socket`);

worker_threads.parentPort.on('message', changes => {
  if (changes.env) {
    for (const key in changes.env)
      process.env[key] = changes.env[key];
  }
});
const shellState = new ShellState();
let isDaemon = false;
const enabledTransports = new Set();
let objectIdPromise;
let lastCommandPromise;
let lastSubshellId = 0;
/** @type {Map<number, import('./ProtocolProxy').ProtocolProxy>} */
const subshells = new Map();
/** @typedef {import('../src/JSConnection').ExtraClientMethods} ShellHandler */
/** @type {{[key in keyof ShellHandler]: (...args: Parameters<ShellHandler[key]>) => (Promise<ReturnType<ShellHandler[key]>)}} */
const handler = {
  'Shell.setIsDaemon': async (params) => {
    isDaemon = !!params.isDaemon;
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
    const {code} = params;
    const {getResult} = require('../shjs/index');
    const {output} = await getResult(code);
    return { result: output };
  },
  'Shell.restore': async () => {
    shellState.restore(message => transport.send(message));
    const senderTransport = transport;
    const result = await lastCommandPromise;
    if (transport === senderTransport)
      clearStoredMessages();
    return result;
  },
  'Shell.runCommand': async ({expression, command}) => {
    lastCommandPromise = send('Runtime.evaluate', {
      expression,
      returnByValue: false,
      generatePreview: true,
      userGesture: true,
      replMode: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    const senderTransport = transport;
    const result = await lastCommandPromise;
    if (senderTransport === transport)
      clearStoredMessages();
    else if (!transport) {
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
          hostname: pathService.hostname(),
          socketPath,
        }
      }));
    }
    return result;
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
  'Shell.createSubshell': async ({sshAddress}) => {
    const { spawnJSProcess } = require('./spawnJSProcess');
    const { ProtocolProxy } = require('./ProtocolProxy');

    const id = ++lastSubshellId;
    const subshell = await spawnJSProcess({ cwd: process.cwd(), sshAddress });
    const proxy = new ProtocolProxy(subshell, message => {
      // TODO what to do when the transport has changed or is gone??
      transport?.send({method: 'Shell.messageFromSubshell', params: { id, message }})
    });
    subshell.onclose = () => {
      transport?.send({method: 'Shell.subshellDestroyed', params: { id }})
    };
    subshells.set(id, proxy);

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
  __proto__: null,
};

function clearStoredMessages() {
  lastCommandPromise = null;
  shellState.clear();
}

async function dispatchToHandler(message, replyTransport) {
  try {
    const result = await handler[message.method](message.params);
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
    fs.unlinkSync(socketPath);
    transport = new PipeTransport(s, s);
    transport.onmessage = message => {
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
      if (isDaemon)
        waitForConnection();
      else
        process.exit(0);
    });
  });
}
process.on('exit', () => {
  if (detached)
    fs.unlinkSync(socketPath);
})

const session = new inspector.Session();
session.connectToMainThread();
session.on('inspectorNotification', notification => {
  if (notification.method === 'Runtime.bindingCalled' && notification.params.name === 'magic_binding') {
    const {method, params} = JSON.parse(notification.params.payload);
    if (method === 'cwd') {
      shellState.setCwd(params, message => transport?.send(message));
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
    return;
  }
  transport?.send(notification);
  shellState.addMessage(notification);
});

/**
 * @template {keyof import('../src/protocol').Protocol.CommandParameters} T
 * @param {T} method
 * @param {import('../src/protocol').Protocol.CommandParameters[T]} params
 * @returns {Promise<import('../src/protocol').Protocol.CommandReturnValues[T]>}
 */
async function send(method, params) {
  return new Promise((resolve, reject) => {
    session.post(method, params, (err, res) => err ? reject(err) : resolve(res));
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

waitForConnection();
