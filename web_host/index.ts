import { EventEmitter } from 'events';
import { handler } from '../host/';

export function onConnect(socket: import('ws').WebSocket, request: any, oid: any) {
  const overrides = {
    ...handler,
    async beep(params, sender) {
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
}