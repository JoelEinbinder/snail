#!/usr/bin/env node
const path = require('path')
process.stdout.write(`\x1b\x1aL${path.join(__dirname, 'index.ts')}\x00`);
/**
* @param {any} data
*/
function send(data) {
  // console.error(data);
  const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
      return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
  });
  process.stdout.write(`\x1b\x1aM${str}\x00`);
}

// process.stdin.on('close', () => process.exit());
setInterval(() => {
  console.log('still alive');
}, 1000);