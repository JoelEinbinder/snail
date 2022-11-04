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

function sendMessageToParent(message) {
  if (window.parent)
    window.parent.postMessage(message, '*');
  else if (window.electronAPI)
    window.electronAPI.notify(message);
  else if (window['webkit'])
    window['webkit'].messageHandlers.wkMessage.postMessage(message);
  else
    throw new Error('could not find a way to send message to parent');
}

function setHeight(height) {
  sendMessageToParent({method: 'setHeight', params: {height}})
}

function setIsFullscreen(isFullscreen) {
  sendMessageToParent({method: 'setIsFullscreen', params: {isFullscreen}})
}

if (window.parent) {
  window.addEventListener('message', event => {
    if (event.source !== window.parent)
      return;
    onMessage(event.data);
  });
} else if (window.electronAPI) {
  window.electronAPI.onEvent('postMessage', onMessage);
} else if (window['webkit']) {
  window['webkit_callback'] = onMessage;
} else {
  throw new Error('could not find a way to recieves messages from parent');
}

function onMessage(data) {
  if ('method' in data) {
    const {method, params} = data;
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
    } else if (method === 'fontChanged') {
      document.body.style.setProperty('--current-font', params);
      window.dispatchEvent(new Event('resize'));
    } else if (method === 'cdpMessage') {
      if (cdpListener)
        cdpListener(params);
    }
  } else {
    const {id, result} = data;
    const callback = messasgeCallbacks.get(id);
    if (callback) {
      callback(result);
      messasgeCallbacks.delete(id);
    }
  }
}

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
    sendMessageToParent({method: 'keyPressed', params: {
      key: event.key,
      code: event.code,
      shiftKey: event.shiftKey,
    }});
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
  sendMessageToParent({method: 'contextMenu', params});
}
function sendInput(data) {
  sendMessageToParent({method: 'sendInput', params: data});
}

/**
 * @param {string} key
 * @param {any} value
 */
function saveItem(key, value) {
  sendMessageToParent({method: 'saveItem', params: {key, value}});
}
/**
 * @param {string} key
 * @return {Promise<any>}
 */
async function loadItem(key) {
  const id = ++lastMessageId;
  sendMessageToParent({method: 'loadItem', params: {key}, id});
  return new Promise(x => messasgeCallbacks.set(id, x));
}

let dprPromise;
async function getDevicePixelRatio() {
  if (dprPromise)
    return dprPromise;
  if (/Chrome/.test(navigator.userAgent))
    return window.devicePixelRatio;
  const id = ++lastMessageId;
  dprPromise = new Promise(resolve => messasgeCallbacks.set(id, resolve));
  sendMessageToParent({method: 'getDevicePixelRatio', id});
  return dprPromise;
}

let cdpListener;

function openDevTools() {
  sendMessageToParent({method: 'openDevTools'});  
}

async function attachToCDP(listener) {
  cdpListener = listener;
  sendMessageToParent({method: 'requestCDP'});
  // TODO throw if not actually connected.
  return message => {
    sendMessageToParent({method: 'cdpMessage', params: message});
  };
}

window.d4 = {
  waitForMessage,
  setHeight,
  setIsFullscreen,
  sendInput,
  createContextMenu,
  saveItem,
  loadItem,
  getDevicePixelRatio,
  attachToCDP,
  openDevTools,
}
sendMessageToParent('ready')