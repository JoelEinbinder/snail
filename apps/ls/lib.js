const path = require('path')
const fs = require('fs');
const os = require('os');

async function run(args, stdout, stderr) {
  stdout.write(`\x1b\x1aL${path.join(__dirname, 'index.js')}\x00`);

  /**
   * @param {any} data
   */
  function send(data) {
      const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
          return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
      });
      stdout.write(`\x1b\x1aM${str}\x00`);
  }
  const resolved = args.length === 1 ? path.resolve(process.cwd(), args[0]) : process.cwd();
  const isDirectory = fs.statSync(resolved).isDirectory();
  const platform = os.platform();
  if (!isDirectory) {
      send({
          dirs: await buildDirInfos(path.dirname(resolved), [path.basename(resolved)]),
          cwd: path.dirname(resolved),
          showHidden: true,
          platform,
      })
  } else {
      const dirs = fs.readdirSync(resolved);
      send({
          dirs: await buildDirInfos(resolved, dirs),
          cwd: resolved,
          showHidden: false,
          platform,
      });
  }
}
async function buildDirInfos(cwd, dirs) {
  const promises = [];
  async function readDir(dir, link) {
    const resolved = link ? link : path.join(cwd, dir);
    const stat = await fs.promises.lstat(resolved);
    if (stat.isSymbolicLink()) {
      const link = path.resolve(path.dirname(resolved), await fs.promises.readlink(resolved));
      try {
        return await readDir(dir, link)
      } catch {
        // intentional fallthrough
      }
    }
    return {
      dir,
      link,
      mode: stat.mode,
      size: stat.size,
      isSymbolicLink: stat.isSymbolicLink(),
      isDirectory: stat.isDirectory(),
    }
  }
  for (const dir of dirs) {
    promises.push(readDir(dir));
  }
  return Promise.all(promises);
}
module.exports = {run};