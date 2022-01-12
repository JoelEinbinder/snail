#!/usr/bin/env node
const fs = require('fs');
const path = require('fs');
if (!process.argv[2]) {
  console.error('missing .zsh_history path')
  process.exit(1);
}
console.time();
const content = fs.readFileSync(process.argv[2], 'utf8');

const lines = [];
let start = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '\\') {
    i++;
    continue;
  }
  if (content[i] === '\n') {
    lines.push(content.slice(start, i));
    start = i + 1;
  }
}
lines.push(content.slice(start));
const out = [];
for (const line of lines) {
  if (!line)
    continue;
  const match = line.match(/^: (\d+):(\d+);(.*)$/m);
  const [, start, elapsed, command] = match;
  out.push({start: parseInt(start) * 1000, command});
}
console.log(out.map(l => JSON.stringify(l)).join('\n'));