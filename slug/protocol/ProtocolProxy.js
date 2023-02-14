/**
 * @typedef {{
 *  send: (message:string) => void,
 *  close: () => void,
 *  onmessage?: (event: {data: string}) => void,
 *  onopen?: () => void,
 * }} ProtocolSocket
 */
class ProtocolProxy {
  /**
   * @param {ProtocolSocket} socket
   * @param {(message: {method: string, params: any}) => void} onEvent
   */
  constructor(socket, onEvent) {
    this.socket = socket;
    /** @type {Set<() => void>} */
    this._closeListeners = new Set();
    this.socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const callback = this.callbacks.get(message.id);
        if (callback) {
          callback(message);
          this.callbacks.delete(message.id);
        } else {
          console.error('Callback not found', message);
        }
      } else {
        onEvent(message);
      }
    }
    this.lastCallbackId = 0;
    this.callbacks = new Map();
  }

  send(method, params) {
    const id = ++this.lastCallbackId;
    const message = JSON.stringify({id, method, params});
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, resolve);
      this.socket.send(message);
    });
  }

  notify(method, params) {
    const message = JSON.stringify({method, params});
    this.socket.send(message);
  }

  /**
   * @param {() => void} listener
   */
  onClose(listener) {
    this._closeListeners.add(listener);
    return () => this._closeListeners.delete(listener);
  }

  close() {
    this.socket.onmessage = null;
    this.socket.close();
    for (const listener of this._closeListeners)
      listener();
    this._closeListeners.clear();
  }
}

module.exports = {ProtocolProxy};
