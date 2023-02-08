#!/usr/bin/env node
const sqlite3 = require('sqlite3');
const path = require('path');

const args = process.argv.slice(2);
const [dbFile, tableName] = args;

const database = new sqlite3.Database(dbFile);
(async function() {

  const tables = new Set(['sqlite_schema']);
  const tableRows = await new Promise(x => database.all(`SELECT 
  name
FROM 
  sqlite_schema
WHERE 
  type ='table'`, (err, rows) => {
    x(rows);
  }));
  for (const row of tableRows)
    tables.add(row.name);
  if (!tables.has(tableName))
    throw new Error('Table not found');

  const rows = await new Promise(x => database.all(`SELECT * FROM ${tableName} LIMIT 100`, function(err, rows) {
    if (err)
      console.error(err);
    x(rows);
  }));
  
  process.stdout.write(`\x1b\x1aL${path.join(__dirname, 'index.ts')}\x00`);
  send({rows});
})().finally(() => {
  database.close();
});

/**
 * @param {any} data
 */
function send(data) {
  const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
      return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
  });
  process.stdout.write(`\x1b\x1aM${str}\x00`);
}
