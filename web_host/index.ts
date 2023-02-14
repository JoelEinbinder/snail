import { EventEmitter } from 'events';
import { handler, proxies } from '../host/';
import { WebServers } from '../host/WebServers';
const webServers = new WebServers(true);
export function onConnect(socket: import('ws').WebSocket, request: import('http').IncomingMessage, oid: any) {
  const overrides = {
    ...handler,
    async beep(params, sender) {},
    async urlForIFrame({shellIds, filePath}: {shellIds: number[], filePath: string}) {
      const [socketId] = shellIds;
      const address = await webServers.ensureServer(proxies.get(socketId)!);
      const url = new URL(`http://localhost:${address.port}`);
      url.pathname = filePath;
      url.search = '?entry';
      return url.href;
    }
  };
  const client: any = new EventEmitter();
  client.send = message => socket.send(JSON.stringify(message));
  socket.onmessage = async (message) => {
    const {method, params, id} = JSON.parse(message.data.toString());
    let error;
    if (!overrides.hasOwnProperty(method)) {
      error = new Error('command not found: ' + method);
    } else {
      try {
        const result = await overrides[method](params, client);
        if (id)
          socket.send(JSON.stringify({result, id}));
        return;
      } catch (e) {
        error = e;
      }
    }
    if (id)
      socket.send(JSON.stringify({error: String(error), id}));
  };
  socket.on('close', () => {
    client.emit('destroyed');
  });
  function log(...args) {
    socket.send(JSON.stringify({method: 'log', params: args}));
  }
}