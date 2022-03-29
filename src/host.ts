export interface IHostAPI {
  sendMessage: (message: {method: string, params?: any}) => Promise<any>;
  notify: (message: {method: string, params?: any}) => void;
  onEvent: (eventName: string, listener: (event: any) => void) => void;
}

function makeHostAPI(): IHostAPI {
  if ('electronAPI' in window)
    return window['electronAPI'];
  if (window['webkit']) {
    const callbacks = new Map<number, {resolve: (value: any) => void, reject: (error: any) => void}>();
    let lastId = 0;
    const listeners = new Map<string, Set<(value: any) => void>>();
    window['webkit_callback'] = message => {
      if (!message) {
        console.log('message is null');
        return;
      }
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
    };
    return {
      notify(message) {
        window['webkit'].messageHandlers.wkMessage.postMessage(message);
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
        window['webkit'].messageHandlers.wkMessage.postMessage({...message, id});
        return promise;
      },
    }
  }
  return null;
}

export const host = makeHostAPI();