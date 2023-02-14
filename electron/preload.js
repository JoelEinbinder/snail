//@ts-check
const { contextBridge, ipcRenderer } = require('electron')

const callbacks = new Map();
let lastId = 0;
const listeners = new Map();
/** @type {import('../src/host').IHostAPI} */
const electronAPI = {
  sendMessage: message => {
    const id = ++lastId;
    const promise = new Promise((resolve, reject) => callbacks.set(id, {resolve, reject}));
    ipcRenderer.invoke('message', {id, ...message});
    return promise;
  },
  notify: message => {
    ipcRenderer.invoke('message', message);
  },
  onEvent: (eventName, listener) => {
    if (!listeners.has(eventName))
      listeners.set(eventName, new Set());
    listeners.get(eventName).add(listener);
  },
  type() { return "electron"; }
};
ipcRenderer.on('message', (sender, event) => {
  if ('id' in event) {
    if (event.error) {
      callbacks.get(event.id).reject(event.error);
    } else {
     callbacks.get(event.id).resolve(event.result);
    }
    callbacks.delete(event.id);
  } else {
    for (const listener of listeners.get(event.method) || [])
      listener(event.params);
  }
})
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

