const path = require('path')
const fs = require('fs');
const os = require('os');
const userid = require('userid');
const mimeTypes = require('mime-types');
async function run(args, stdout, stderr) {
  stdout.write(`\x1b\x1aL${path.join(__dirname, 'index.ts')}\x00`);

  /**
   * @param {any} data
   */
  function send(data) {
      const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
          return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
      });
      stdout.write(`\x1b\x1aM${str}\x00`);
  }
  const directoryArgs = args.filter(arg => !arg.startsWith('-'));
  const resolved = directoryArgs.length === 1 ? path.resolve(process.cwd(), directoryArgs[0]) : process.cwd();
  const isDirectory = fs.statSync(resolved).isDirectory();
  const platform = os.platform();
  if (!isDirectory) {
      send({
          args,
          dirs: await buildDirInfos(path.dirname(resolved), [path.basename(resolved)]),
          cwd: path.dirname(resolved),
          showHidden: true,
          platform,
      })
  } else {
      const dirs = fs.readdirSync(resolved);
      send({
          args,
          dirs: await buildDirInfos(resolved, dirs),
          cwd: resolved,
          showHidden: args.some(a => a.startsWith('-') && a.includes('a')),
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
      nlink: stat.nlink,
      uid: stat.uid,
      gid: stat.gid,
      username: userid.username(stat.uid),
      groupname: userid.groupname(stat.gid),
      mtime: stat.mtime.toJSON(),
      atime: stat.atime.toJSON(),
      birthtime: stat.birthtime.toJSON(),
      mode: stat.mode,
      size: stat.size,
      isSymbolicLink: stat.isSymbolicLink(),
      isDirectory: stat.isDirectory(),
      isFIFO: stat.isFIFO(),
      isSocket: stat.isSocket(),
      isBlockDevice: stat.isBlockDevice(),
      isCharacterDevice: stat.isCharacterDevice(),
      isFile: stat.isFile(),
      mimeType: mimeTypes.lookup(resolved) || '',
    }
  }
  for (const dir of dirs) {
    promises.push(readDir(dir));
  }
  return Promise.all(promises);
}
module.exports = {run};