const path = require('path')
const fs = require('fs');
const os = require('os');
const userid = require('userid');
const mimeTypes = require('mime-types');
/**
 * @return {Promise<number>}
 */
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
  let directoryArgs = args.filter(arg => !arg.startsWith('-'));
  if (directoryArgs.length === 0)
    directoryArgs = ['.'];
  const cwd = directoryArgs.length === 1 ? path.resolve(process.cwd(), directoryArgs[0]) : process.cwd();
  if (directoryArgs.length === 1)
    directoryArgs = ['.']
  const platform = os.platform();
  try {
    send({
        args,
        dirs: await Promise.all(directoryArgs.map(dir => {
          return buildItemInfo(cwd, path.resolve(cwd, dir), 1);
        })),
        cwd,
        showHidden: args.some(a => a.startsWith('-') && a.includes('a')),
        platform,
    });
  } catch (error) {
    stderr.write(String(error) + '\n');
    return 1;
  }
  return 0;
}

async function buildItemInfo(parentDir, filePath, depth) {
  async function readDir(link) {
    const resolved = link ? link : filePath;
    const stat = await fs.promises.lstat(resolved).catch(e => {
      if (e.errno === -2)
        throw `ls: ${path.relative(process.cwd(), resolved)}: No such file or directory`;
      return e;
    });
    if (stat.isSymbolicLink()) {
      const link = path.resolve(path.dirname(resolved), await fs.promises.readlink(resolved));
      try {
        return await readDir(link);
      } catch {
        // intentional fallthrough
      }
    }
    const isDirectory = stat.isDirectory();
    return {
      dir: resolved === parentDir ? path.basename(resolved) : path.relative(parentDir, resolved),
      fullPath: resolved,
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
      isDirectory,
      isFIFO: stat.isFIFO(),
      isSocket: stat.isSocket(),
      isBlockDevice: stat.isBlockDevice(),
      isCharacterDevice: stat.isCharacterDevice(),
      isFile: stat.isFile(),
      mimeType: mimeTypes.lookup(resolved) || '',
      children: isDirectory ? await makeChildrenForDirectory() : undefined,
    }
  }
  async function makeChildrenForDirectory() {
    if (depth === 0)
      return undefined;
    const items = await fs.promises.readdir(filePath);
    return Promise.all(items.map(item => {
      return buildItemInfo(filePath, path.join(filePath, item), depth - 1);
    }));
  }
  return readDir();
}
module.exports = {run};