
export type ExecutionArgs<Readable, Writable> = {
  args: string[],
  stdout: Writable,
  stderr: Writable,
  stdin: Readable,
  env: {[key: string]: string},
  noSideEffects: boolean,
  signal: AbortSignal,
}

export interface Platform<Readable, Writable> {
  createWritable(write: (chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) => void): Writable,
  homedir: () => string,
  aliases: {[key: string]: string[]},
  safeExecutables: ReadonlyMap<string, {args: ReadonlySet<string|undefined>}>,
  getBashFunctions: () => readonly string[],
  builtins: {[key: string]: (params: ExecutionArgs<Readable, Writable>) => Promise<number>|'pass'},
  getEnv: () => {readonly [key: string]: string};
  getCwd: () => string;
  glob: (parts: (string|{glob: string})[]) => string[];
  runBashAndExtractEnvironment(
    command: 'source' | 'eval',
    args: string[],
    stdout: Writable,
    stderr: Writable,
    stdin: Readable,
  ): Promise<number>;
  treatAsDirectory(executable: string): boolean;
  launchProcess(
    stdio: (Readable|Writable|number|undefined|null)[],
    redirects: {from: number, file: string, type: 'write'|'append'|'read'}[],
    executable: string,
    args: string[],
    env: {[key: string]: string},
  )
}