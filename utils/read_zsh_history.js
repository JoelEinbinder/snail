const path = require('path');
console.time('require');
const sqlite3 = require('sqlite3');
console.timeEnd('require');
const database = new sqlite3.Database(path.join(__dirname, '..', 'history.sqlite3'), async () => {
  console.time('read');
    const out = await database.all('SELECT command FROM history ORDER BY commandId ASC', async (error, row) => {
        console.timeEnd('read');
        // console.log(out, error, row);
    })
});
