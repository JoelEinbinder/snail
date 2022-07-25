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
  if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey)
    return;
  const codeMap = {
    'KeyC': '\x03',
    'KeyD': '\x04',
  }
  if (event.code in codeMap) {
    event.preventDefault();
    sendInput(codeMap[event.code]);
  }
});

function sendInput(data) {
  window.parent.postMessage({method: 'sendInput', params: data}, '*');
}

window.d4 = {
  waitForMessage,
  setHeight,
  setIsFullscreen,
  sendInput,
}
window.parent.postMessage('ready', '*')