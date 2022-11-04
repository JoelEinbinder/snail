const path = require('path');

function startWebBlock(options) {
  const str = JSON.stringify(options).replace(/[\u007f-\uffff]/g, c => { 
    return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
  });
  process.stdout.write(`\x1b\x1aL${str}\x00`);
}

startWebBlock({
  entry: path.join(__dirname, 'web.ts'),
  browserView: true,
});

function send(data) {
  const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
    return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
  });
  process.stdout.write(`\x1b\x1aM${str}\x00`);
}

process.stdin.on('close', () => process.exit());
process.stdin.on('data', () => {
  // stay alive to keep the web block fullscreen
});
