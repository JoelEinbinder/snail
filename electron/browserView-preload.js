//@ts-check
const { contextBridge, ipcRenderer } = require('electron')

const listeners = new Map();
/** @type {import('../src/host').IHostAPI} */
const electronAPI = {
  sendMessage: message => {
    throw new Error('BrowserView can only notify');
  },
  notify: message => {
    ipcRenderer.invoke('browserView-postMessage', message);
  },
  onEvent: (eventName, listener) => {
    if (!listeners.has(eventName))
      listeners.set(eventName, new Set());
    listeners.get(eventName).add(listener);
  },
  type() { return "electron-BrowserView"; }
};
ipcRenderer.on('postMessage', (sender, event) => {
  for (const listener of listeners.get('postMessage') || [])
    listener(event);
});
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

