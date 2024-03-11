import * as snail from '../../sdk/web';
import { RPC } from '../../sdk/rpc-js';
import { LogBookView } from './LogBookView';
snail.setIsFullscreen(true);
document.addEventListener('keydown', event => {
  if ((event.code === 'KeyX' || event.code === 'KeyC') && event.ctrlKey) {
    event.preventDefault();
    event.stopPropagation();
    rpc.notify('close', {});
  }
});
const transport: Parameters<typeof RPC>[0] = {
  send(message) {
    snail.sendInput(JSON.stringify(message) + '\n');
  },
};
const rpc = RPC(transport, {
});
const view = new LogBookView((sql, params) => rpc.send('queryDatabase', { sql, params }));
document.body.append(view.element);
view.focus();
try {
while (true) {
  const message = await snail.waitForMessage<any>();
  transport.onmessage!(message);
}
} catch (e) {
  console.error(e);
}
