#!/usr/bin/env node
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.on('line', line => {
  const {content, id} = JSON.parse(line);
  const tokens = content.split('\n').map((text, index) => {
    return {
      text: text + '\n',
      color: ['#555', '#bbb'][index % 2],
      hover: ['#555', '#bbb'][index % 2],
    };
  })
  process.stdout.write(JSON.stringify({tokens, id}) + '\n');
});