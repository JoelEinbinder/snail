const inspector = require('inspector');
const net = require('net');
const fs = require('fs');
const {PipeTransport} = require('../protocol/pipeTransport');
const unixSocketServer = net.createServer();
const os = require('os');
const path = require('path');
const socketDir = path.join(os.tmpdir(), '1d4-sockets');
const socketPath = path.join(socketDir, `${process.pid}.socket`);

unixSocketServer.listen({
  path: socketPath,
});

/** @type {PipeTransport|null} */
let transport = null;
let detached = true;
unixSocketServer.on('connection', (s) => {
  detached = false;
  fs.unlinkSync(socketPath);
  transport = new PipeTransport(s, s);
  transport.onmessage = message => {
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
    // TODO check if demon and keep alive
    process.exit(0);
  });
});
process.on('exit', () => {
  if (detached)
    fs.unlinkSync(socketPath);
})

const session = new inspector.Session();
session.connectToMainThread();
session.on('inspectorNotification', notification => {
  transport?.send(notification);
});

