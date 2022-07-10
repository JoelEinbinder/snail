const messages = [];
const callbacks = [];
async function waitForMessage() {
  if (messages.length)
    return messages.shift();
  return new Promise(resolve => callbacks.push(resolve));
}

function setHeight(height) {
  window.parent.postMessage({method: 'setHeight', params: {height}}, '*')
}

window.addEventListener('message', event => {
  if (callbacks.length) {
    callbacks.shift()(event.data);
    return;
  }
  messages.push(event.data);
});
window.d4 = {
  waitForMessage,
  setHeight,
}
window.parent.postMessage('ready', '*')