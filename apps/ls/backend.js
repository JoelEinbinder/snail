const path = require('path')
process.stdout.write(`\x1bL${path.join(__dirname, 'index.js')}\x00`);

function send(data) {
  process.stdout.write(`\x1bM${JSON.stringify(data)}\x00`);
}

const fs = require('fs');
const dirs = fs.readdirSync(process.cwd());
send({
  dirs,
  cwd: process.cwd(),
});