#!/usr/bin/env node
const path = require('path');
const sqlite3 = require('sqlite3');
const { tokenize } = require('../../shjs/tokenizer');
const { parse } = require('../../shjs/parser');
const database = new sqlite3.Database(path.join(require('../../path_service').homedir(), '.terminal-history.sqlite3'));
database.all('SELECT command FROM history', {}, function(err, rows) {
  if (err)
    throw err;
  const mode = 'global';
  if (mode === 'global') {
    const map = new Map();
    for (const {command} of rows) {
      map.set(command, (map.get(command) || 0) + 1);
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    console.log(sorted.slice(0, 10));
  } else if (mode === 'executables') {
    const map = new Map();
    for (const {command} of rows) {
      try {
        const {tokens, raw} = tokenize(command, x => {throw new Error('no templates')});
        if (raw !== command)
          continue;
        const parsed = parse(tokens);
        if (!parsed.executable)
          continue;        
        map.set(parsed.executable, (map.get(parsed.executable) || 0) + 1);
      } catch {}
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    console.log(sorted.slice(0, 100));
  } else if (mode === 'git') {
    const map = new Map();
    for (const {command} of rows) {
      try {
        const {tokens, raw} = tokenize(command, x => {throw new Error('no templates')});
        if (raw !== command)
          continue;
        const parsed = parse(tokens);
        if (parsed.executable !== 'git')
          continue;
        map.set(command, (map.get(command) || 0) + 1);
      } catch {}
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    console.log(sorted.slice(0, 10));
  }
});