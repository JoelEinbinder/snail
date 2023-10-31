import { makeExecute } from '../slug/shjs/execute';
import { pathResolve, pathJoin, pathBasename, pathRelative } from './path';
import { dungeon } from './dungeon';
declare var process;
export function makeWebExecutor() {
    type Writable = {
    write: (chunk: any, encoding?: any, callback?: (error?: Error) => void) => void;
    end: () => void;
  }
  const aliases = {};
  const builtins = {
    __git_ref_name: async () => {
      return 0;
    },
    __is_git_dirty: async () => {
      return 0;
    },
    __command_completions: async (args, stdout, stderr, stdin, env) => {
      for (const key of Object.keys(builtins)) {
        if (key.startsWith('__'))
          continue;
        stdout.write(key + '\n');
      }
      for (const key of Object.keys(aliases))
        stdout.write(key + '\n');
      // await Promise.all(env.PATH.split(':').map(async dir => {
      //   const names = await fs.promises.readdir(dir).catch(e => []);
      //   for (const name of names) {
      //     try {
      //       const stat = fs.statSync(path.join(dir, name));
      //       if (stat.mode & 0o111 && !stat.isDirectory())
      //         stdout.write(name + '\n');
      //     } catch { }
      //   }
      // }));
      return 0;
    },
    __file_completions: async (args, stdout, stderr) => {
      const type = args[0];
      const dir = pathResolve(dungeon.cwd.current, args[1] || '');
      const names = await dungeon.readdir(dir).catch(e => []);
      for (const name of names) {
          if (type === 'all') {
              stdout.write(name + '\n');
          } else {
              try {
                  const stat = await dungeon.lstat(pathJoin(dir, name));
                  if (type === 'directory' && stat.isDirectory())
                      stdout.write(name + '\n');
                  else if (type === 'executable' && stat.isDirectory())
                      stdout.write(name + '\n');
              } catch {}
          }
      }
      return 0;
    },
  
    __find_all_files: async (args, stdout, stderr, stdin, env) => {
      const maxFiles = parseInt(args[0] || '1');
      let filesSeen = 0;
      async function traverse(path: string) {
        if (filesSeen >= maxFiles)
          return;
        if (path !== dungeon.cwd.current) {
          filesSeen++;
          stdout.write(pathRelative(dungeon.cwd.current, path) + '\n');
        }
        const stat = await dungeon.lstat(path);
        if (!stat.isDirectory())
          return;
        const names = await dungeon.readdir(path);
        for (const name of names)
          await traverse(pathJoin(path, name));
      }
      await traverse(dungeon.cwd.current);
      return 0;
    },

    __environment_variables: async (args, stdout, stderr, stdin, env) => {
        stdout.write(JSON.stringify(env) + '\n');
        return 0;
    },
    help: async(args, stdout, stderr) => {
      const command = args[0];
      if (!command) {
        stdout.write('cd: traverse directories\r\n');
        stdout.write('ls: view the contents of a directory\r\n');
        stdout.write('cat: view the contents of a file\r\n');
        stdout.write('open: some things can be opened\r\n');
        stdout.write('use: use an item\r\n');
        stdout.write('player: see info about your stats\r\n');
        stdout.write('help: view this help\r\n');
        stdout.write('\r\n');
        stdout.write('For further detail on a command, use `help <command>`\r\n');
      } else {
        if (command === 'cd') {
          stdout.write('`cd <directory_name>` to travel to that directory\r\n');
          stdout.write('`cd ..` to travel up a level\r\n');
        } else if (command === 'ls') {
          stdout.write('`ls` to view the current directory contents\r\n');
          stdout.write('`ls <directory_name>` to view the contents of some other directory\r\n');
        } else if (command === 'help') {
          stdout.write('A fan of recursion?');
        } else {
          stdout.write(`sorry, no help available for ${JSON.stringify(command)}\r\n`);
          return 1;
        }
      }
      return 0;
    },
    cd: async (args, stdout, stderr, stdin) => {
      const [dir = process.env.HOME] = args;
      return dungeon.chdir(pathResolve(dungeon.cwd.current, dir), stdout, stderr, stdin);
    },
    cat: async (args, stdout, stderr, stdin, env ) => {
      for (const arg of args) {
        const dir = pathResolve(dungeon.cwd.current, arg);
        const stat = await dungeon.lstat(dir).catch(e => e);
        if (stat.errno == -2) {
          stderr.write(`cat: ${arg}: No such file or directory`);
          return 1;
        }
        if (stat.isDirectory()) {
          stderr.write(`cat: ${arg}: Is a directory`);
          return 1;
        }
        const content = await dungeon.readFile(dir);
        stdout.write(content);
      }
      return 0;
    },
    echo: async (args, stdout, stderr, stdin, env) => {
      stdout.write(args.join(' ') + '\n');
      return 0;
    },
    reconnect: async (args, stdout, stderr, stdin, env) => {
      return 1;
    },
    pwd: async (args, stdout, stderr, stdin, env) => {
      stdout.write(dungeon.cwd.current + '\n');
      return 0;
    },
    clear: async (args, stdout, stderr, stdin, env) => {
      stdout.write('\x1b[H\x1b[2J');
      return 0;
    },
    ls: async (args, stdout, stderr, stdin, env) => {
      stdout.write(`\x1b\x1aL${JSON.stringify({ entry: 'ls'})}\x00`);
      function send(data) {
        const str = JSON.stringify(data).replace(/[\u007f-\uffff]/g, c => { 
            return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
        });
        stdout.write(`\x1b\x1aM${str}\x00`);
      }
      let directoryArgs = args.filter(arg => !arg.startsWith('-'));
      if (directoryArgs.length === 0)
        directoryArgs = ['.'];
      const cwd = directoryArgs.length === 1 ? pathResolve(process.cwd(), directoryArgs[0]) : process.cwd();
      if (directoryArgs.length === 1)
        directoryArgs = ['.']
      try {
        send({
            args,
            dirs: await Promise.all(directoryArgs.map(dir => {
              return buildItemInfo(cwd, pathResolve(cwd, dir), 1);
            })),
            cwd,
            showHidden: args.some(a => a.startsWith('-') && a.includes('a')),
            platform: 'game',
        });
      } catch (error) {
        stderr.write(String(error) + '\n');
        return 1;
      }
      return 0;
      async function buildItemInfo(parentDir: string, filePath: string, depth: number) {
        async function readDir() {
          const resolved = filePath;
          const stat = await dungeon.lstat(resolved).catch(e => {
            if (e.errno === -2)
              throw `ls: ${pathRelative(process.cwd(), resolved)}: No such file or directory`;
            return e;
          });
          const isDirectory = stat.isDirectory();
          return {
            dir: resolved === parentDir ? pathBasename(resolved) : pathRelative(parentDir, resolved),
            fullPath: resolved,
            nlink: stat.nlink,
            uid: stat.uid,
            gid: stat.gid,
            username: 'game', //userid.username(stat.uid),
            groupname: 'game', //userid.groupname(stat.gid),
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
            mimeType: '', //mimeTypes.lookup(resolved) || '',
            children: isDirectory ? await makeChildrenForDirectory() : undefined,
          }
        }
        async function makeChildrenForDirectory() {
          if (depth === 0)
            return undefined;
          const items = await dungeon.readdir(filePath);
          return Promise.all(items.map(item => {
            return buildItemInfo(filePath, pathJoin(filePath, item), depth - 1);
          }));
        }
        return readDir();
      }
      
    },
    open: async (args, stdout, stderr, stdin, env) => {
      for (const arg of args) {
        const ret = await dungeon.open(pathResolve(dungeon.cwd.current, arg), stdout, stderr, stdin);
        if (ret !== 0)
          return ret;
      }
      return 0;
    },
    use: async (args, stdout, stderr, stdin, env) => {
      for (const arg of args) {
        const ret = dungeon.useItem(arg, stdout, stderr);
        if (ret !== 0)
          return ret;
      }
      return 0;
    },
  };
  const env: {[key: string]: string} = { HOME: '/home/adventurer' };
  const { execute } = makeExecute<any, Writable>({
    aliases,
    builtins,
    getEnv: () => env,
    homedir: () => '/home/adventurer',
    isDirectory: path => {
      return dungeon.isDirectory(pathResolve(dungeon.cwd.current, path));
    },
    isExecutable: path => false,
    makeWritable: write => null as any,
    runExecutable: ({args, env, executable, inputs}) => {
      inputs[2].write(`command not found: ${executable}\n`);	
      return {
        closePromise: Promise.resolve(1),
        kill: () => void 0,
        stdin: undefined,
      }
    },
    globFiles: parts => {
      return [];
    },
  });
  return {execute, aliases, env};
}
