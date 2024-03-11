//@ts-check
const messages = [];
const callbacks = [];
/** @type {import('../../src/shortcutParser').ParsedShortcut[]} */
let activeShortcuts = [];
let lastMessageId = 0;
const messasgeCallbacks = new Map();
async function waitForMessage() {
  if (messages.length)
    return messages.shift();
  return new Promise(resolve => callbacks.push(resolve));
}

function sendMessageToParent(message) {
  if (window.parent && window.parent !== window)
    window.parent.postMessage(message, '*');
  else if (window['electronAPI'])
    window['electronAPI'].notify(message);
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

if (window.parent && window.parent !== window) {
  window.addEventListener('message', event => {
    if (event.source !== window.parent)
      return;
    onMessage(event.data);
  });
} else if (window['electronAPI']) {
  window['electronAPI'].onEvent('postMessage', onMessage);
} else if (window['webkit']) {
  window['webkit_callback'] = onMessage;
} else {
  throw new Error('could not find a way to recieves messages from parent');
}

function onMessage(data) {
  if ('method' in data) {
    const {method, params, id} = data;
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
        cdpListener.onMessage(params.message, params.browserViewUUID);
    } else if (method === 'updateDebugees') {
      if (cdpListener)
        cdpListener.onDebuggeesChanged(params);
    } else if (method === 'requestJSON') {
      const json = typeof _toJSON === 'function' ? _toJSON() : _toJSON;
      sendMessageToParent({id, result: {json}});
    } else if (method === 'setActiveShortcuts') {
      activeShortcuts = params;
    } else if (method === 'requestActions') {
      const actions = (typeof myActions === 'function' ? myActions() : myActions) || [];
      actionCallbacks = [];
      for (const action of actions) {
        const id = actionCallbacks.length;
        actionCallbacks.push(action.callback);
        action.callback = id;
      }
      sendMessageToParent({id, result: {actions}});
    } else if (method === 'runAction') {
      const callback = actionCallbacks[params];
      if (callback)
        callback();
    } else if (method === 'setFind') {
      if (!params) {
        findParams = null;
      } else {
        const regex = new RegExp(params.regex.source, params.regex.flags);
        findParams = {
          regex,
          report: matches => {
            sendMessageToParent({ method: 'reportFindMatches', params: { matches }});
          }
        };
      }
      findHandler?.(findParams);
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

let chording = false;
window.addEventListener('keydown', event => {
  if (event.defaultPrevented)
    return;
  if (!chording) {
    if (event.code === 'KeyA' && event.ctrlKey) {
      chording = true;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  } else {
    if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta')
      return;
    chording = false;
    sendMessageToParent({method: 'chordPressed', params: {
      key: event.key,
      code: event.code,
      shiftKey: event.shiftKey,
    }});
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

window.addEventListener('keydown', event => {
  if (event.defaultPrevented)
    return;
  const hasShortcut = activeShortcuts.some(shortcut => {
    if (shortcut.ctrlKey !== undefined && shortcut.ctrlKey !== event.ctrlKey)
      return false;
    if (shortcut.metaKey !== undefined && shortcut.metaKey !== event.metaKey)
      return false;
    if (shortcut.altKey !== undefined && shortcut.altKey !== event.altKey)
      return false;
    if (shortcut.shiftKey !== undefined && shortcut.shiftKey !== event.shiftKey)
      return false;
    if (shortcut.key.toLowerCase() !== event.key.toLowerCase() && shortcut.key !== event.code)
      return false;
    return true;
  });
  if (hasShortcut) {
    event.preventDefault();
    sendMessageToParent({ method: 'keyPressed', params: {
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
    }});
    return;
  }
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
 * @param {EventTarget|null} target
 */
function isEditing(target) {
  if (!target || !(target instanceof HTMLElement))
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
 * @param {import('../sdk/web').MenuItem[]} menuItems
 */
function serializeMenuItems(menuItems) {
  return menuItems.map(item => {
    /** @type {any} */
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
 * @param {import('../sdk/web').MenuItem[]} descriptor
 * @param {boolean=} noDefaultItems
 */
function createContextMenu(descriptor, noDefaultItems) {
  contextMenuCallbacks.clear();
  const params =  {menuItems: serializeMenuItems(descriptor), noDefaultItems};
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

/** @type {{onMessage: (message: any, browserViewUUID?: string) => void, onDebuggeesChanged: (debuggees: {[key: string]: import('../sdk/web').DebuggingInfo}) => void}} */
let cdpListener;

function openDevTools() {
  sendMessageToParent({method: 'openDevTools'});  
}

const ua = navigator.userActivation;
async function tryToRunCommand(command) {
  if (!ua.isActive)
    return;
  sendMessageToParent({method: 'tryToRunCommand', params: {command}});
}

function close() {
  sendMessageToParent({method: 'close'});
}

/** @param {typeof cdpListener} listener */
async function attachToCDP(listener) {
  cdpListener = listener;
  sendMessageToParent({method: 'requestCDP'});
  // TODO throw if not actually connected.
  return (message, browserViewUUID) => {
    sendMessageToParent({method: 'cdpMessage', params: {message, browserViewUUID}});
  };
}

window.addEventListener('contextmenu', event => {
  if (event.defaultPrevented)
    return;
  createContextMenu([{
    title: 'Inspect Me',
    callback: () => {
      sendMessageToParent({method: 'requestInspect'});
    }
  }]);
  event.preventDefault();
});

let _toJSON;
function setToJSON(toJSON) {
  _toJSON = toJSON;
}

let myActions;
let actionCallbacks;
function setActions(actions) {
  myActions = actions;
}

let asyncWorkId = 0;
function startAsyncWork(name = 'Anonymous Work') {
  const id = ++asyncWorkId;
  sendMessageToParent({method: 'startAsyncWork', params: {name, id}});
  return () => sendMessageToParent({method: 'finishWork', params: {id}});
}

let asyncWorkContextId = 0;
function expectingUserInput(name = 'Anonymous Work Context') {
  const id = ++asyncWorkContextId;
  sendMessageToParent({method: 'expectingUserInput', params: {name, id}});
  return () => sendMessageToParent({method: 'resolveUserInput', params: {id}});
}

/** @type {(params: import('../sdk/web').FindParams|null) => void} */
let findHandler;
/** @type {import('../sdk/web').FindParams|null} */
let findParams = null;
/**
 * @param {(params: import('../sdk/web').FindParams|null) => void} _findHandler
 */
function setFindHandler(_findHandler) {
  findHandler = _findHandler;
  findHandler?.(findParams);
}

// Hack to put focus somewhere. Otherwise electron loses keyboard events?!
document.body.tabIndex = -1;
document.body.focus();
document.body.removeAttribute('tabIndex');

window.snail = {
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
  setToJSON,
  setActions,
  startAsyncWork,
  expectingUserInput,
  tryToRunCommand,
  close,
  setFindHandler,
}
sendMessageToParent('ready')