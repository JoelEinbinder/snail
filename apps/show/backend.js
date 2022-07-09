#!/usr/bin/env node
const path = require('path')
// process.stdout.write(`\x1bL${path.join(__dirname, 'index.ts')}\x00`);
const args = process.argv.slice(2);
const live = args.includes('-f');
/**
* @param {any} data
*/
function send(data) {
  // console.error(data);
  const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
      return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
  });
  // process.stdout.write(`\x1bM${str}\x00`);
}
function go() {
  const resolved = path.resolve(process.cwd(), args.find(a => !a.startsWith('-')));
  send({
    filePath: resolved,
    mimeType: require('mime-types').lookup(resolved),
  });
  
}

go();
if (live) {
  const fs = require('fs');
  const resolved = path.resolve(process.cwd(), args.find(a => !a.startsWith('-')));
  const watcher = fs.watch(resolved, (event, filename) => {
    go();
  });
}