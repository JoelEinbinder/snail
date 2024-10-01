function display(filePath) {
  process.stdout.write(`\x1b\x1aL${filePath}\x00`);
}
function send(data, dontCache) {
  const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
      return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
  });
  process.stdout.write(`\x1b\x1a${dontCache ? 'Q' : 'M'}${str}\x00`);
}
const {RPC} = require('./rpc-js');
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
    send(data, /* dontCache */ data.id !== undefined);
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
        let parsed;
        try {
          parsed = JSON.parse(message);
        } catch {
          console.error(JSON.stringify(message));
          throw new Error('failed to parse json');
        }
        this.onmessage.call(null, parsed);
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
const THROTTLE_SPEED = 16;

class Throttle {
  constructor() {
    process.on('exit', () => {
      if (this.timer)
        this.fire();
    });
  }
  lastFired = null;
  timer = null;
  promise = Promise.resolve();
  callback = null;
  fire() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.doFire();
    this.callback();
    this.callback = null;
    this.lastFired = Date.now();
  }

  doFire() {
    // override this
  }

  scheduleFire() {
    if (this.timer)
      return;
    this.timer = setTimeout(() => {
      this.fire();
    }, THROTTLE_SPEED);
    this.timer.unref();
  }

  setNeedsToFire() {
    if (!this.callback)
      this.promise = new Promise(callback => this.callback = callback);
    if (this.lastFired === null || Date.now() - this.lastFired > THROTTLE_SPEED) {
      this.fire();
    } else {
      this.scheduleFire();
    }
    return this.promise;
  }
}
class ThrottleProgress extends Throttle {
  progress = null;
  update(progress) {
    this.progress = progress;
    return this.setNeedsToFire();
  }
  doFire() {
    process.stdout.write(`\x1b\x1a\x4e${JSON.stringify(typeof this.progress === 'function' ? this.progress() : this.progress)}\x00`);
  }
}
class ThrottleChart extends Throttle {
  data = [];
  update(data) {
    this.data.push(data);
    return this.setNeedsToFire();
  }
  doFire() {
    process.stdout.write(`\x1b\x1aC${JSON.stringify(this.data.length === 1 ? this.data[0] : this.data)}\x00`);
    this.data = [];
  }
}
const progressThrottle = new ThrottleProgress();
const chartThrottle = new ThrottleChart();
/** @typedef {{ progress: number, leftText?: string, rightText?: string }|number} ProgressOptions */
/**
 * @param {ProgressOptions|(() => ProgressOptions)} progress
 */
function setProgress(progress) {
  return progressThrottle.update(progress);
}

function chart(data) {
  return chartThrottle.update(data);
}

module.exports = { display, send, makeRPC, setProgress, chart};