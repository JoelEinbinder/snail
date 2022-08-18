/// <reference path="./types.d.ts" />
const messages = [];
const callbacks = [];
let lastMessageId = 0;
const messasgeCallbacks = new Map();
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
  if ('method' in event.data) {
    const {method, params} = event.data;
    if (method === 'message') {
      if (callbacks.length) {
        callbacks.shift()(params);
        return;
      }
      messages.push(params);
    } else if (method === 'contextMenuCallback') {
      const callback = contextMenuCallbacks.get(params.id);
      if (callback)
        callback(params.data);
      contextMenuCallbacks.clear();
    }
  } else {
    const {id, result} = event.data;
    const callback = messasgeCallbacks.get(id);
    if (callback) {
      callback(result);
      messasgeCallbacks.delete(id);
    }
  }
});

window.addEventListener('keydown', event => {
  if (event.defaultPrevented)
    return;
  if (event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
    const codeMap = {
      'KeyC': '\x03',
      'KeyD': '\x04',
    }
    if (event.code in codeMap) {
      event.preventDefault();
      sendInput(codeMap[event.code]);
    }
  } else if (!event.ctrlKey && !event.altKey && !event.metaKey && event.key.length === 1 && !isEditing(event.target)) {
    event.preventDefault();
    window.parent.postMessage({method: 'keyPressed', params: {
      key: event.key,
      code: event.code,
      shiftKey: event.shiftKey,
    }}, '*');
  }
});

/**
 * @param {HTMLElement} target
 */
function isEditing(target) {
  if (!target)
    return false;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
    return true;
  if (target.isContentEditable)
    return true;
  return false;
}

const contextMenuCallbacks = new Map();
let lastCallback = 0;
/**
 * @param {MenuItem[]} menuItems
 */
function serializeMenuItems(menuItems) {
  return menuItems.map(item => {
    const serialized = {
      ...item,
    };
    if (item.callback) {
      const id = ++lastCallback;
      contextMenuCallbacks.set(id, item.callback);
      serialized.callback = id;
    }
    if (item.submenu)
      serialized.submenu = serializeMenuItems(item.submenu);
    return serialized;
  });
}
/**
 * @param {MenuItem[]} menuItems
 */
function createContextMenu(descriptor) {
  contextMenuCallbacks.clear();
  const params =  {menuItems: serializeMenuItems(descriptor)};
  window.parent.postMessage({method: 'contextMenu', params}, '*');
}
function sendInput(data) {
  window.parent.postMessage({method: 'sendInput', params: data}, '*');
}

/**
 * @param {string} key
 * @param {any} value
 */
function saveItem(key, value) {
  window.parent.postMessage({method: 'saveItem', params: {key, value}}, '*');
}
/**
 * @param {string} key
 * @return {Promise<any>}
 */
async function loadItem(key) {
  const id = ++lastMessageId;
  window.parent.postMessage({method: 'loadItem', params: {key}, id}, '*');
  return new Promise(x => messasgeCallbacks.set(id, x));
}


window.d4 = {
  waitForMessage,
  setHeight,
  setIsFullscreen,
  sendInput,
  createContextMenu,
  saveItem,
  loadItem,
}
window.parent.postMessage('ready', '*')