#!/usr/bin/env node
const path = require('path')
process.stdout.write(`\x1b\x1aL${path.join(__dirname, '..', 'src', 'index.ts')}\x00`);
class Transport {
  constructor() {
    this._pendingMessage = '';
    /** @type {(message: any) => void} */
    this.onmessage = undefined;
    process.stdin.on('data', buffer => this._dispatch(buffer));
    
  }
  send(data) {
    const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
      return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
    });
    process.stdout.write(`\x1b\x1aM${str}\x00`);
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
    const message = this._pendingMessage + buffer.toString(undefined, 0, end);
    setImmediate(() => {
      try {
      if (this.onmessage)
        this.onmessage.call(null, JSON.parse(message));
      } catch(e) {
        console.error(message.slice(0, 10), e);
      }
    });

    let start = end + 1;
    end = buffer.indexOf('\n', start);
    while (end !== -1) {
      const message = buffer.toString(undefined, start, end);
      setImmediate(() => {
        if (this.onmessage)
          this.onmessage.call(null, JSON.parse(message));
      });
      start = end + 1;
      end = buffer.indexOf('\n', start);
    }
    this._pendingMessage = buffer.toString(undefined, start);
  }
}
const transport = new Transport();
const {RPC} = require('../protocol/rpc');
const {handler} = require('../host/');
const {EventEmitter} = require('events');
const client = new EventEmitter();
client.send = message => transport.send(message);

const overrides = {
  close() {
    process.exit(0);
  },
  beep() {
    // no op here, we can't beep until IFrameBlock can beep
  },
  setProgress() {
    // no op here, we can't beep until IFrameBlock can setProgress
  },
  ...handler,
}
const rpc = RPC(transport, ({method, params}) => {
  return overrides[method](params, client);
});
process.stdin.setRawMode(true);
