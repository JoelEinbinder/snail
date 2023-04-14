/// <reference path="../../iframe/types.d.ts" />
import { RPC } from '../../protocol/rpc-js';
import { LogBookView } from './LogBookView';
d4.setIsFullscreen(true);
document.addEventListener('keydown', event => {
  if ((event.code === 'KeyX' || event.code === 'KeyC') && event.ctrlKey) {
    event.preventDefault();
    event.stopPropagation();
    rpc.notify('close', {});
  }
});
const transport: Parameters<typeof RPC>[0] = {
  send(message) {
    d4.sendInput(JSON.stringify(message) + '\n');
  },
};
const rpc = RPC(transport, {
});
const view = new LogBookView((sql, params) => rpc.send('queryDatabase', { sql, params }));
document.body.append(view.element);
try {
while (true) {
  const message = await d4.waitForMessage<any>();
  transport.onmessage!(message);
}
} catch (e) {
  console.error(e);
}
