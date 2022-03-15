//@ts-check
const { contextBridge, ipcRenderer } = require('electron')

const callbacks = new Map();
let lastId = 0;
const listeners = new Map();
/** @type {import('../src/electronAPI').IElectronAPI} */
const electronAPI = {
  sendMessage: message => {
    const id = ++lastId;
    const promise = new Promise(x => callbacks.set(id, x));
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
};
ipcRenderer.on('message', (sender, event) => {
  if ('id' in event) {
    callbacks.get(event.id)(event.result);
    callbacks.delete(event.id);
  } else {
    for (const listener of listeners.get(event.method) || [])
      listener(event.params);
  }
})
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

