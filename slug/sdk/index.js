function display(filePath) {
  process.stdout.write(`\x1b\x1aL${filePath}\x00`);
}
function send(data) {
  const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
      return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
  });
  process.stdout.write(`\x1b\x1aM${str}\x00`);
}
const {RPC} = require('../protocol/rpc');
const crypto = require('node:crypto');
class Transport {
  constructor() {
    this._pendingMessage = '';
    /** @type {(message: any) => void} */
    this.onmessage = undefined;
    process.stdin.on('data', buffer => this._dispatch(buffer));
    this._secretKey = crypto.randomUUID();
    this._sawSecret = false;
    process.stdout.write(`\x1b\x1aP${this._secretKey}\x00`);
  }
  send(data) {
    send(data);
  }

  /**
   * @param {Buffer} buffer
   */
   _dispatch(buffer) {
    let end = buffer.indexOf('\n');
    if (end === -1) {
      this._pendingMessage += buffer.toString();
      return;
    }
    /**
     * @param {string} message
     */
    const sendMessage = message => {
      if (!this._sawSecret) {
        const index = message.indexOf(this._secretKey);
        if (index === -1)
          return; // TODO print this out somehow so that apps can handle pretyping
        message = message.substring(index + this._secretKey.length);
        this._sawSecret = true;
      }
      setImmediate(() => {
        if (this.onmessage)
          this.onmessage.call(null, JSON.parse(message));
      });
    };
    sendMessage(this._pendingMessage + buffer.toString(undefined, 0, end));

    let start = end + 1;
    end = buffer.indexOf('\n', start);
    while (end !== -1) {
      sendMessage(buffer.toString(undefined, start, end));
      start = end + 1;
      end = buffer.indexOf('\n', start);
    }
    this._pendingMessage = buffer.toString(undefined, start);
  }
}
function makeRPC(handler) {
  process.stdin.setRawMode(true);
  return RPC(new Transport(), handler);
}
module.exports = { display, send, makeRPC};