const inspector = require('inspector');
const net = require('net');
const fs = require('fs');
const {PipeTransport} = require('../protocol/pipeTransport');
const os = require('os');
const path = require('path');
const socketDir = path.join(os.tmpdir(), '1d4-sockets');
const socketPath = path.join(socketDir, `${process.pid}.socket`);


let isDaemon = false;
const enabledTransports = new Set();
const handler = {
  'Shell.setIsDaemon': (params) => {
    isDaemon = !!params.isDaemon;
    for (const transport of enabledTransports)
      transport.send({method: 'Shell.daemonStatus', params: {isDaemon}});
  },
  'Shell.enable': (params) => {
    enabledTransports.add(transport);
    transport.send({method: 'Shell.daemonStatus', params: {isDaemon}});
  },
  'Shell.disable': (params) => {
    enabledTransports.delete(transport);
  },
  'Shell.evaluate': async (params) => {
    const {code} = params;
    const {getResult} = require('../shjs/index');
    const {output} = await getResult(code);
    return { result: output };
  },
  'Shell.resolveFileForIframe': async (params) => {
    const response = await require('./webserver').resolveFileForIframe(params);
    return {response};
  },
  __proto__: null,
};

async function dispatchToHandler(message) {
  try {
    const result = await handler[message.method](message.params);
    if ('id' in message)
      transport?.send({id: message.id, result});
  } catch(e) {
    if ('id' in message)
      transport?.send({id: message.id, error: {message: String(e)}});
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
        dispatchToHandler(message);
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
      transport = null;
      enabledTransports.delete(transport);
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
  transport?.send(notification);
});

waitForConnection();