#!/usr/bin/env node
const path = require('path');
const { makeRPC, send, display } = require('../slug/sdk/');
display(path.join(__dirname, '..', 'src', 'index.ts'));

const {handler} = require('../host/');
const {EventEmitter} = require('events');
const client = new EventEmitter();
client.send = message => send(message);

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
const rpc = makeRPC(({method, params}) => {
  return overrides[method](params, client);
});
process.stdin.setRawMode(true);
