
// This file should not use nodejs code. It might run in the browser.

class UserError extends Error { }

/**
 * @template [Readable=import('stream').Readable]
 * @template {{
 *  end: () => void,
 *  write: (chunk: any, encoding?: BufferEncoding,
 *  callback?: (error: Error) => void) => void,
 *  destroyed: boolean,
 *  on: (event: 'error', listener: (err: Error) => void) => Writable,
 * }} [Writable=import('stream').Writable]
 * @param {import('./platform').Platform<Readable, Writable>} platform
 */
function makeExecutor(platform) {

  function createNullWriter() {
    return platform.createWritable((chunk, encoding, callback) => callback());
  }
  /**
   * @param {import('./ast').Word} word
   * @return {string[]}
   */
  function processWord(word) {
    if (typeof word === 'string')
      return [word];
    /** @type {(string|{glob: string})[]} */
    const parts = [];
    for (const part of word) {
      if (typeof part === 'string')
        parts.push(part);
      else if ('replacement' in part)
        parts.push(computeReplacement(part.replacement));
      else
        parts.push(part);
    }
    if (parts.some(x => typeof x !== 'string')) {
      const output = platform.glob(parts);
      if (!output.length)
        throw new UserError(`No matches found: ${word.map(x => typeof x === 'string' ? x : 'replacement' in x ? x.replacement : 'glob' in x ? x.glob : x).join('')}`);
      return output;
    }
    return [parts.join('')];
  }

  /**
   * @param {string} replacement
   */
  function computeReplacement(replacement) {
    const env = platform.getEnv();
    if (replacement === '~')
      return env.HOME || platform.homedir();
    if (replacement === '~+')
      return platform.getCwd();
    if (replacement === '~-')
      return env.OLDPWD || '~-';
    if (replacement.startsWith('$')) {
      const key = replacement.substring(1);
      return key in env ? env[key] : '';
    }
    throw new Error(`Unknown replacement: ${replacement}`);
  }
  /**
   * @param {string} executable
   * @param {string[]} args
   */
  function processAlias(executable, args) {
    const seen = new Set();
    while (executable in platform.aliases && !seen.has(executable)) {
      seen.add(executable);
      const [newExecutable, ...newArgs] = platform.aliases[executable];
      executable = newExecutable;
      args.unshift(...newArgs);
    }
    return {
      executable,
      args,
    }
  }
  /**
   * @param {import('./ast').Expression|null} expression
   * @param {boolean} noSideEffects
   * @param {Writable} stdout
   * @param {Writable} stderr
   * @param {Readable|null=} stdin
   * @return {{stdin: Writable|null, kill: (signal: number) => boolean, closePromise: Promise<number>}}
   */
  function execute(expression, noSideEffects, stdout, stderr, stdin) {
    if (!expression) {
      return {
        closePromise: Promise.resolve(0),
        stdin: createNullWriter(),
        kill: () => false,
      }
    }
    try {
      if ('executable' in expression) {
        const { redirects } = expression;
        if (noSideEffects && redirects?.length)
          throw new Error('side effect');
        const { executable, args } = processAlias(processWord(expression.executable)[0], expression.args.flatMap(processWord));
        const env = { ...platform.getEnv() };
        if (noSideEffects && expression.assignments?.length)
          throw new Error('side effect');
        for (const { name, value } of expression.assignments || [])
          env[name] = processWord(value)[0];
        if (noSideEffects) {
          const entry = platform.safeExecutables.get(executable);
          if (!entry)
            throw new Error('side effect');
          if (!entry.args.has(undefined) && !entry.args.has(args[0]))
            throw new Error('side effect');
        }
        if (platform.getBashFunctions().includes(executable)) {
          return {
            closePromise: platform.runBashAndExtractEnvironment('eval', [executable, ...args], stdout, stderr, stdin),
            stdin: createNullWriter(),
            kill: () => void 0,
          }
        }
        if (executable in platform.builtins) {
          const controller = new AbortController();
          const signal = controller.signal;
          const closePromise = platform.builtins[executable]({ args, stdout, stderr, stdin, env, noSideEffects, signal });
          if (closePromise !== 'pass') {
            return {
              closePromise,
              stdin: createNullWriter(),
              kill: () => void controller.abort(),
            }
          }
        }
        if (args.length === 0 && !expression.assignments?.length && platform.treatAsDirectory(executable)) {
          return execute({ executable: 'cd', args: [executable], redirects }, noSideEffects, stdout, stderr, stdin);
        } else {
          return platform.launchProcess(
            [stdin, stdout, stderr],
            (redirects || []).map(r => {
              return { file: processWord(r.to)[0], from: r.from, type: r.type };
            }),
            executable,
            args,
            env,
          );
        }
      } else if ('pipe' in expression) {
        const callbacks = new Set();
        let pipeClosed = false;
        const interruptableStdin = platform.createWritable((chunk, encoding, callback) => {
          if (pipeClosed || pipe.stdin.destroyed) {
            callback();
            return;
          }
          callbacks.add(callback);
          pipe.stdin.write(chunk, encoding, err => {
            // EPIPE is fine, it just means the pipe process was closed
            if (err?.['code'] === 'EPIPE')
              err = null;
            callbacks.delete(callback);
            callback(err);
          });
        });
        const pipe = execute(expression.pipe, noSideEffects, stdout, stderr);
        pipe.stdin.on('error', err => {
          if (err?.['code'] === 'EPIPE')
            return;
          throw err;
        });
        const main = execute(expression.main, noSideEffects, interruptableStdin, stderr, stdin);
        const closePromise = main.closePromise.then(() => {
          pipe.stdin.end();
          return pipe.closePromise;
        });
        pipe.closePromise.then(() => {
          pipeClosed = true;
          for (const callback of callbacks)
            callback();
          callbacks.clear();
        });
        return {
          stdin: main.stdin, kill: (...args) => {
            const result1 = main.kill(...args);
            const result2 = pipe.kill(...args);
            return result1 && result2;
          }, closePromise
        };
      } else if ('left' in expression) {
        const writableStdin = platform.createWritable((chunk, encoding, callback) => {
          active.stdin.write(chunk, encoding, callback);
        });
        const left = execute(expression.left, noSideEffects, stdout, stderr, stdin);
        let active = left;
        let killed = false;
        const closePromise = left.closePromise.then(async code => {
          if (killed)
            return code;
          if (!!code === (expression.type === 'or')) {
            const right = execute(expression.right, noSideEffects, stdout, stderr, stdin);
            active = right;
            return right.closePromise;
          }
          return code;
        });
        return {
          stdin: writableStdin,
          kill: (...args) => {
            killed = true;
            return active.kill(...args);
          },
          closePromise,
        };
      }
    } catch (error) {
      if (!(error instanceof UserError))
        throw error;
      stderr.write(`shjs: ${error.message}\n`);
      return {
        closePromise: Promise.resolve(1),
        stdin: createNullWriter(),
        kill: () => void 0,
      }
    }
  }
  return { execute, processAlias };
}

module.exports = { makeExecutor };