/// <reference path="../iframe/types.d.ts" />
export interface IHostAPI {
  sendMessage: (message: {method: string, params?: any}) => Promise<any>;
  notify: (message: {method: string, params?: any}) => void;
  onEvent: (eventName: string, listener: (event: any) => void) => void;
  type(): string;
}

function makeHostAPI(): IHostAPI {
  if ('electronAPI' in window)
    return window['electronAPI'];
  if (window['webkit']) {
    const {host, callback} = hostApiHelper('webkit', message => window['webkit'].messageHandlers.wkMessage.postMessage(message));
    window['webkit_callback'] = callback;
    return host;
  }
  if ('acquireVsCodeApi' in window) {
    const api = window['acquireVsCodeApi']();
    const {host, callback} = hostApiHelper('vscode', message => {
      api.postMessage(message);
    });
    window.addEventListener('message', event => {
      if ((event.source as WindowProxy).parent === window)
        return;
      callback(event.data);
    });
    return host;
  }
  if ('d4' in window) {
    window.d4.setIsFullscreen(true);
    const {host, callback} = hostApiHelper('d4', message => {
      if (message.method === 'contextMenu') {
        // async contextMenu({ menuItems }, client, sender) {
        //   let resolve;
        //   /**
        //    * @return {Electron.MenuItemConstructorOptions}
        //    */
        //   function convertItem(item) {
        //     if (!item.title)
        //       return {type: 'separator'};
        //     return {
        //       label: item.title,
        //       click: item.callback ? () => {
        //         resolve(item.callback)
        //       } : undefined,
        //       submenu: item.submenu ? item.submenu.map(convertItem) : undefined,
        //       checked: item.checked,
        //       type: item.checked ? 'checkbox' : undefined,
        //     }
        //   }
        //   const menu = Menu.buildFromTemplate(menuItems.map(convertItem));
        //   const promise = new Promise(x => resolve = x);
        //   menu.popup(BrowserWindow.fromWebContents(sender));
        //   const id = await promise;
        //   return {id};
        // },

        function unserializeMenuItems(menuItems) {
          return menuItems.map(item => {
            const unserialized = {
              ...item,
            };
            if (item.callback) {
              unserialized.callback = () => {
                callback({id: message.id, result: {id: item.callback}});
              };
            }
            if (item.submenu)
              unserialized.submenu = unserializeMenuItems(item.submenu);
            return unserialized;
          });
        }
        d4.createContextMenu(unserializeMenuItems(message.params.menuItems));
        return;
      }
      window.d4.sendInput(JSON.stringify(message) + '\n');
    });
    (async function() {
      while(true) {
        const message = await window.d4.waitForMessage();
        callback(message);
      }
    })();
    return host;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
  const socket = new WebSocket(`${protocol + window.location.host + window.location.pathname}`);
  const openPromise = new Promise(x => socket.onopen = x);
  const {host, callback} = hostApiHelper('web', async message => {
    await openPromise;
    socket.send(JSON.stringify(message));
  });
  socket.onmessage = event => {
    callback(JSON.parse(event.data));
  };
  return host;
}

function hostApiHelper(type: string, postMessage: (message: any) => void) {
  const callbacks = new Map<number, {resolve: (value: any) => void, reject: (error: any) => void}>();
  let lastId = 0;
  const listeners = new Map<string, Set<(value: any) => void>>();
  const host: IHostAPI = {
    notify(message) {
      postMessage(message);
    },
    onEvent(eventName, listener) {
      if (!listeners.has(eventName))
        listeners.set(eventName, new Set());
      listeners.get(eventName).add(listener);
    },
    sendMessage(message) {
      const id = ++lastId;
      const promise = new Promise<any>((resolve, reject) => {
        callbacks.set(id, {resolve, reject});
      });
      postMessage({...message, id});
      return promise;
    },
    type() { return type },
  }
  return {
    host,
    callback(message: any) {
      if (message.id) {
        if ('error' in message)
          callbacks.get(message.id).reject(message.error);
        else
          callbacks.get(message.id).resolve(message.result);
        callbacks.delete(message.id);
      }
      else {
        const l = listeners.get(message.method);
        if (l)
          l.forEach(listener => listener(message.params));
      }
    }
  };
}

export const host = makeHostAPI();
document.body.classList.toggle(`${host.type()}-host`, true);
host.onEvent('log', args => console.log(...args));
