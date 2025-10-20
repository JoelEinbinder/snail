//@ts-check
const worker_threads = require('node:worker_threads');
const worker = new worker_threads.Worker(require.resolve('./bootstrapWorker'));
const { createRequire } = require('module');

worker.on('exit', code => {
  process.exit(code);
});

process.on('exit', () => {
  try {
    // The worker might not be able to clean up the metadata path
    const path = require('path');
    const pathService = require('../path_service/');
    const socketDir = path.join(pathService.tmpdir(), 'snail-sockets');
    const metadataPath = path.join(socketDir, `${process.pid}.json`);
    const fs = require('fs');
    fs.unlinkSync(metadataPath);
  } catch {
    
  }
});


const {Runtime} = require('./runtime');
const runtime = new Runtime();

const {sh} = require('../shjs/jsapi');
process.env.SNAIL_NODE_PATH = process.execPath;
global.sh = sh;
global.pty = runtime.pty.bind(runtime);
global._abortPty = runtime.abortPty.bind(runtime);

function updateRequire() {
  global.require = createRequire(process.cwd() + '/[eval]');
}

global.bootstrap = (args) => {
  delete global.bootstrap;
  const binding = global.magic_binding;
  delete global.magic_binding;
  function notify(method, params) {
    binding(JSON.stringify({method, params}));
  }
  runtime.setNotify(notify);

  const origChangeDir = process.chdir;

  process.chdir = function(path) {
    const before = process.cwd();
    const returnValue = origChangeDir.apply(this, arguments);
    const after = process.cwd();
    if (before !== after) {
      updateRequire();
      notify('cwd', after);
    }

    return returnValue;
  }
  updateRequire();
  return runtime.respond.bind(runtime);
};


let errorCount = 0;
process.on('unhandledRejection', e => {
  errorCount++;
  if (errorCount > 4)
    return;
  console.error(e);
});

process.on('uncaughtException', e => {
  errorCount++;
  if (errorCount > 4)
    return;
  console.error(e);
});

