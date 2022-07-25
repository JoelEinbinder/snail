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

function setIsFullscreen(isFullscreen) {
  window.parent.postMessage({method: 'setIsFullscreen', params: {isFullscreen}}, '*')
}

window.addEventListener('message', event => {
  if (callbacks.length) {
    callbacks.shift()(event.data);
    return;
  }
  messages.push(event.data);
});

window.addEventListener('keydown', event => {
  if (event.defaultPrevented)
    return;
  window.parent.postMessage({method: 'keydown', params: {
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    repeat: event.repeat,
  }}, '*')
})
window.d4 = {
  waitForMessage,
  setHeight,
  setIsFullscreen,
}
window.parent.postMessage('ready', '*')