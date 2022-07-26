//@ts-check
const path = require('path');
const child_process = require('child_process');
const { PipeTransport } = require('../protocol/pipeTransport');
const { RPC } = require('../protocol/rpc');

class Shell {
  /** @param {string=} sshAddress */
  constructor(sshAddress) {
    if (sshAddress) {
      this.process = child_process.spawn('ssh', [sshAddress, 'PATH=$PATH:/usr/local/bin node ~/gap-year/shell/worker.js'], {
        stdio: ['pipe', 'pipe', 'inherit'],
      });
    } else {
      const nodePath = process.execPath.endsWith('node') ? process.execPath : '/usr/local/bin/node';
      this.process = child_process.spawn(nodePath, [path.join(__dirname, 'worker.js')], {
        stdio: ['pipe', 'pipe', 'inherit'],
      });
    }
    const transport = new PipeTransport(this.process.stdin, this.process.stdout);
    let urlCallback;
    this.urlPromise = new Promise(resolve => {
      urlCallback = resolve;
    });
    this.rpc = RPC(transport, {
      url: url => {
        urlCallback(url);
      },
    });
  }

  /**
   * @param {string} code
   * @return {Promise<string>}
   */
  async evaluate(code) {
    return this.rpc.send('evaluate', code);
  }

  /**
   * @param {string} dir
   */
  async chdir(dir) {
    return this.rpc.send('chdir', dir);
  }

  async env(env) {
    return this.rpc.send('env', env);
  }

  async aliases(aliases) {
    return this.rpc.send('aliases', aliases);
  }

  async resolveFileForIframe({filePath, search, headers}) {
    return this.rpc.send('resolveFileForIframe', {filePath, search, headers});
  }

  close() {
    this.process.kill();
    if (this.server) {
      this.server.close();
      delete this.server;
      delete this.serverAddressPromise;
    }
  }

  async startOrGetServer() {
    if (this.serverAddressPromise)
      return this.serverAddressPromise;
    const http = require('http');
    const server = this.server = http.createServer(async (req, res) => {
      try {
        const {pathname, search} = new URL(String(req.url), 'http://' + req.headers.host);
        const filePath = decodeURIComponent(pathname);
        const response = await this.resolveFileForIframe({filePath, search, headers: req.headers});
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
      server.listen(undefined, '127.0.0.1', () => {
        resolve(server.address());
      });  
    });
    return this.serverAddressPromise;
  }
}

module.exports = { Shell };