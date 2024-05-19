import type { ShellHost } from '../host/ShellHost';
export interface IHostAPI {
  sendMessage<Key extends keyof ShellHost>(message: {method: Key, params?: Parameters<ShellHost[Key]>[0]}): Promise<ReturnType<ShellHost[Key]>>;
  notify<Key extends keyof ShellHost>(message: {method: Key, params?: Parameters<ShellHost[Key]>[0]}): void;
  onEvent: (eventName: string, listener: (event: any) => void) => void;
  type(): string;
}

function makeHostAPI(): IHostAPI {
  if ('electronAPI' in window)
    return window['electronAPI'] as IHostAPI;
  if ('acquireVsCodeApi' in window) {
    const api = (window['acquireVsCodeApi'] as any)();
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
  if (window['snail']) {
    const snail: typeof import('../slug/sdk/web') = window['snail'];
    snail.setIsFullscreen(true);
    const {host, callback} = hostApiHelper('snail', message => {
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
        snail.createContextMenu(unserializeMenuItems(message.params.menuItems));
        return;
      }
      snail.sendInput(JSON.stringify(message) + '\n');
    });
    (async function() {
      while(true) {
        const message = await snail.waitForMessage();
        callback(message);
      }
    })();
    return host;
  }
  if (window['webkit']) {
    const {host, callback} = hostApiHelper('webkit', message => window['webkit'].messageHandlers.wkMessage.postMessage(message));
    window['webkit_callback'] = callback;
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
document.body.classList.toggle(`${String(navigator['userAgentData']?.platform).toLocaleLowerCase()}-platform`, true);
host.onEvent('log', args => console.log(...args));

/** @type {Map<number, CustomAsyncIterator>} */
const iterators = new Map();
host.onEvent('streaming', ({id, value, done}) => {
  const iterator = ensureIterator(id);
  if (done) {
    iterator.markDone();
  } else {
    iterator.provideValue(value);
  }
});
class CustomAsyncIterator<T> {
  done = false;
  buffer: T[] = [];
  _tick = () => void 0;
  tickPromise: Promise<void>;
  constructor() {
    this.tick();
  }
  tick() {
    this._tick();
    /** @type {Promise<void>} */
    this.tickPromise = new Promise(resolve => this._tick = resolve);
  }
  provideValue(value: T) {
    this.buffer.push(value);
    this.tick();
  }
  markDone() {
    this.done = true;
    this.tick();
  }
  async next() {
    if (this.buffer.length)
      return { value: this.buffer.shift(), done: false };
    if (this.done)
      return { value: undefined, done: true };
    await this.tickPromise;
    return {
      value: this.buffer.shift(),
      done: this.done
    }
  }
}
function ensureIterator(id: number) {
  if (!iterators.has(id))
    iterators.set(id, new CustomAsyncIterator());
  return iterators.get(id);
}
export async function sendStreamingCommandToHost<Key extends keyof ShellHost>(method: Key, params: Parameters<ShellHost[Key]>[0]): Promise<ReturnType<ShellHost[Key]>> {
  const { streamingId } = await host.sendMessage({method, params});
  return {
    [Symbol.asyncIterator]: () => ensureIterator(streamingId),
  } as any;
}