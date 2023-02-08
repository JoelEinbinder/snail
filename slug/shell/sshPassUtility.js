const net = require('net');
const readline = require('readline');
const fs = require('fs');
class SSHPassUtility {
  /**
   * @param {string} socketPath
   * @param {(data: any) => Promise<any>} passProvider
   */
  constructor(socketPath, passProvider) {
    this._unixSocketServer = net.createServer();
    this._socketPath = socketPath;
    this._unixSocketServer.listen({
      path: socketPath,
    });
    this.listeningPromise = new Promise(x => {
      this._unixSocketServer.once('listening', x);
    });
    this._unixSocketServer.on('connection', (s) => {
      
      const rl = readline.createInterface(s);
      rl.on('line', async line => {
        const data = JSON.parse(line);
        const result = await passProvider(data);
        s.write(JSON.stringify(result) + '\n');
      });
    });
  }

  close() {
    this._unixSocketServer.close();
    if (fs.existsSync(this._socketPath))
      fs.unlinkSync(this._socketPath);
  }
}

module.exports = { SSHPassUtility };