//@ts-check
const { contextBridge, ipcRenderer } = require('electron')

/** @type {import('../src/electronAPI').IElectronAPI} */
const electronAPI = {
  sendMessage: message => ipcRenderer.invoke('message', message),
  onEvent: listener => ipcRenderer.on('event', (sender, event) => listener(event)),
};
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

