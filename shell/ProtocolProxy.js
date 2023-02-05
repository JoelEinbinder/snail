class ProtocolProxy {
  /**
   * @param {{send: (message:string) => void, close: () => void, onmessage?: (event: {data: string}, onopen?: () => void) => void}} socket
   * @param {(message: {method: string, params: any}) => void} onEvent
   */
  constructor(socket, onEvent) {
    this.socket = socket;
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

  close() {
    this.socket.onmessage = null;
    this.socket.close();
    if (this.server) {
      this.server.close();
      delete this.server;
      delete this.serverAddressPromise;
    }
  }
  
  async startOrGetServer(allowAnyConnection) {
    if (this.serverAddressPromise)
      return this.serverAddressPromise;
    const http = require('http');
    const server = this.server = http.createServer(async (req, res) => {
      try {
        const {pathname, search} = new URL(String(req.url), 'http://' + req.headers.host);
        const filePath = decodeURIComponent(pathname);
        const out = await this.send('Shell.resolveFileForIframe', {shellIds: [], filePath, search, headers: req.headers});
        if (out.error)
          throw new Error(out.error.message);
        const {result: {response}} = out;
        const headers = response.headers || {};
        headers['Content-Type'] = response.mimeType;
        res.writeHead(response.statusCode, headers);
        res.end(response.data !== undefined ? Buffer.from(response.data, 'base64') : undefined);
      } catch(e) {
        console.error(e);
        res.writeHead(500);
        res.end();
      }
    });
    this.serverAddressPromise = new Promise(resolve => {
      server.listen(undefined, allowAnyConnection ? undefined : '127.0.0.1', () => {
        resolve(server.address());
      });  
    });
    return this.serverAddressPromise;
  }
}

module.exports = {ProtocolProxy};