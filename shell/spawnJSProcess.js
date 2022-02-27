const {spawn} = require('child_process');
const path = require('path');

/** @return {Promise<string>} */
async function waitForURL(child) {
  let buffer = '';
  let resolve;
  const promise = new Promise(r => resolve = r);
  child.stderr.on('data', onData);
  const url = await promise;
  child.stderr.off('data', onData);
  return url;
  function onData(data) {
    buffer += data.toString();
    const regex = /Debugger listening on (.*)/
    const result = regex.exec(buffer);
    if (!result)
      return;
    resolve(result[1]);
  }
}

async function spawnJSProcess() {
  const child = spawn('node', ['-e', `
    require(${JSON.stringify(path.join(__dirname, 'bootstrap.js'))});
  `], {
    stdio: 'pipe',
    detached: false
  });
  const url = await waitForURL(child);
  return {url, child};
}

module.exports = {spawnJSProcess};