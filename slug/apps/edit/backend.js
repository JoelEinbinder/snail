#!/usr/bin/env node
const path = require('path');
const {RPC} = require('../../protocol/rpc');
const fs = require('fs');
process.stdout.write(`\x1b\x1aL${path.join(__dirname, 'index.ts')}\x00`);
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
const rpc = RPC(transport, {
  async save({file, content}) {
    await fs.promises.writeFile(file, content);
  },
  async close() {
    process.exit(0);
  }
});
const pathArg = process.argv[2];
let absolutePath;
let relativePath;
if (pathArg) {
  absolutePath = path.resolve(pathArg);
  relativePath = path.relative(process.cwd(), absolutePath);
}
let content = '';
let newFile = true;
try {
  if (pathArg) {
    content = fs.readFileSync(absolutePath, 'utf8');
    newFile = false;
  }
} catch {

}
rpc.notify('setContent', {
  content: content,
  absolutePath,
  relativePath,
  newFile, 
});
process.stdin.setRawMode(true);
// process.exit(0);
