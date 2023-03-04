import { makeExecute } from '../slug/shjs/execute';
export function makeWebExecutor() {
    type Writable = {
    write: (chunk: any, encoding?: BufferEncoding, callback?: (error?: Error) => void) => void;
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
    echo: async (args, stdout, stderr, stdin, env) => {
      stdout.write(args.join(' ') + '\n');
      return 0;
    },
  };
  const env: {[key: string]: string} = { HOME: '/home/user' };
  const { execute } = makeExecute<any, Writable>({
    aliases,
    builtins,
    getEnv: () => env,
    homedir: () => '/home/user',
    isDirectory: path => false,
    isExecutable: path => false,
    makeWritable: write => null as any,
    runExecutable: ({args, env, executable, inputs}) => {
      console.warn('runExecutable', {args, env, executable, inputs})
      return {
        closePromise: Promise.resolve(0),
        kill: () => void 0,
        stdin: undefined,
      }
    },
  });
  return {execute, aliases, env};
}