#!/usr/bin/env node
const path = require('path');
const https = require('https');
process.stdout.write(`\x1b\x1aL${path.join(__dirname, 'index.ts')}\x00`);
https.get('https://xkcd.com/atom.xml', res => {
  var body = '';
  res.on('data', function(chunk) {
    body += chunk;
  });
  res.on('end', function() {
    send(body);
  });
});
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
