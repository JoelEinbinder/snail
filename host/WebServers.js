class WebServers {
  /**
   * @param {boolean} allowAnyConnection
   */
  constructor(allowAnyConnection) {
    this._allowAnyConnection = allowAnyConnection;
    /** @type {WeakMap<import('../slug/protocol/ProtocolProxy').ProtocolProxy, Promise<import('net').AddressInfo>>} */
    this._proxyToServerAddressPromise = new WeakMap();
  }

  /**
   * @param {import('../slug/protocol/ProtocolProxy').ProtocolProxy} proxy
   */
  async ensureServer(proxy) {
    let serverAddressPromise = this._proxyToServerAddressPromise.get(proxy)
    if (serverAddressPromise)
      return serverAddressPromise;
    const http = require('http');
    const server = http.createServer(async (req, res) => {
      try {
        const {pathname, search} = new URL(String(req.url), 'http://' + req.headers.host);
        const filePath = decodeURIComponent(pathname);
        const out = await proxy.send('Shell.resolveFileForIframe', {shellIds: [], filePath, search, headers: req.headers});
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
    serverAddressPromise = new Promise(resolve => {
      server.listen(undefined, this._allowAnyConnection ? undefined : '127.0.0.1', () => {
        resolve(server.address());
      });
    });
    this._proxyToServerAddressPromise.set(proxy, serverAddressPromise);
    proxy.onClose(() => {
      server.close();
      this._proxyToServerAddressPromise.delete(proxy);
    });
    
    return serverAddressPromise;
  }
}

module.exports = { WebServers };