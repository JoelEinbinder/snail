const {spawn} = require('child_process');

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
  const child = spawn(process.execPath, ['-e', `process.stdin.on('data', () => void 0); require('inspector').open(undefined, undefined, false);  `], {
    stdio: 'pipe',
    detached: false
  });
  const url = await waitForURL(child);
  return {url, child};
}

module.exports = {spawnJSProcess};