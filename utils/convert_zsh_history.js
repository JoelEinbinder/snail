#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
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
console.time('require');
const sqlite3 = require('sqlite3');
console.timeEnd('require');
const database = new sqlite3.Database(path.join(require('../path_service/').homedir(), '.terminal-history.sqlite3'), async () => {
  const y = await new Promise(x => database.run(`CREATE TABLE IF NOT EXISTS history (
    command_id INTEGER PRIMARY KEY AUTOINCREMENT,
    start INTEGER,
    end INTEGER,
    command TEXT,
    output TEXT,
    git_hash TEXT,
    git_branch TEXT,
    git_dirty TEXT,
    git_diff TEXT,
    pwd TEXT,
    home TEXT,
    username TEXT,
    hostname TEXT,
    exit_code INTEGER
  )`, x));
  console.time('insert');
  for (const line of out) {
    await new Promise(x=> database.run('INSERT INTO history(start, command) VALUES (?, ?)', [line.start, line.command], x));
  }
  console.timeEnd('insert');
});
// sqlite3
// console.log(out.map(l => JSON.stringify(l)).join('\n'));