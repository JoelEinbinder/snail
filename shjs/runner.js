const {spawn, spawnSync} = require('child_process');
const {Writable, Readable} = require('stream');
const fs = require('fs');
/**
 * @type {{env?: {[key: string]: string}, cwd?: string}}
 */
let changes = null;

/** @type {Object<string, (args: string[], stdout: Writable, stderr: Writable) => Promise<number>>} */
const builtins = {
    cd: async (args, stdout, stderr) => {
        try {
            process.chdir(args[0]);
            if (!changes)
                changes = {};
            changes.cwd = process.cwd();
        } catch (e) {
            stderr.write(e.message + '\n');
            return 1;
        }
        return 0;
    },
    export: async (args, stdout, stderr) => {
        for (const arg of args) {
            const index = arg.indexOf('=');
            if (index === -1) {
                stderr.write('export must contain a value\n');
                return 1;
            }
            const key = arg.substring(0, index);
            const value = arg.substring(index + 1);
            if (!changes)
                changes = {};
            if (!changes.env)
                changes.env = {};
            process.env[key] = value;
            changes.env[key] = value;
        }
        return 0;
    },
    declare: async (args, stdout, stderr) => {
        if (args[0] !== '-x') {
            stderr.write('declare is only supported with -x\n');
            return 1;
        }
        return builtins.export(args.slice(1), stdout, stderr);
    },
    __git_ref_name: async (args, stdout, stderr) => {
        const env = {
            ...process.env,
            GIT_OPTIONAL_LOCKS: '0',
        };
        const isGit = spawnSync('git', ['rev-parse', '--git-dir'], { env });
        if (isGit.status)
            return 0;
        const symbolicRef = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], { env });
        if (symbolicRef.status === 0) {
            stdout.write(symbolicRef.stdout);
            return 0;
        }
        const commit = spawnSync('git', ['rev-parse', 'HEAD'], { env });
        if (commit.status === 0) {
            stdout.write(commit.stdout);
            return 0;
        }
        return 0;
    },
    __is_git_dirty: async (args, stdout, stderr) => {
        const env = {
            ...process.env,
            GIT_OPTIONAL_LOCKS: '0',
        };
        const isGit = spawnSync('git', ['rev-parse', '--git-dir'], { env });
        if (isGit.status)
            return 0;
        const status = spawnSync('git', ['status', '--porcelain'], { env });
        if (status.status)
            return 0;
        if (stdout.toString().trim())
            stdout.write("dirty\n");
        return 0;
    }
};

/** @type {Object<string, string[]>} */
const aliases = {
    ls: ['ls', '-G'],
    gbc: ['git', 'for-each-ref', '--sort=committerdate', 'refs/heads/', `--format=%(HEAD) %(color:yellow)%(refname:short)%(color:reset) - %(color:red)%(objectname:short)%(color:reset) - %(contents:subject) - %(authorname) (%(color:green)%(committerdate:relative)%(color:reset))`],
}

/**
 * @param {string} executable
 */
function treatAsDirectory(executable) {
    const result = spawnSync('which', ['-s', executable]);
    if (result.status === 0)
        return false;
    return fs.statSync(executable).isDirectory();
}

/**
 * @param {string} executable
 * @param {string[]} args
 */
function processAlias(executable, args) {
    const seen = new Set();
    while (executable in aliases && !seen.has(executable)) {
        seen.add(executable);
        const [newExecutable, ...newArgs] = aliases[executable];
        executable = newExecutable;
        args.unshift(...newArgs);
    }
    return {
        executable,
        args,
    }
}

/**
 * @param {import('./ast').Word} word
 * @return {string}
 */
function processWord(word) {
    if (typeof word === 'string')
        return word;
    const parts = [];
    for (const part of word) {
        if (typeof part === 'string')
            parts.push(part);
        else
            parts.push(computeReplacement(part.replacement));
    }
    return parts.join('');
}

/**
 * @param {string} replacement
 */
function computeReplacement(replacement) {
    if (replacement === '~')
        return process.env.HOME;
    if (replacement.startsWith('$')) {
        const key = replacement.substring(1);
        return key in process.env ? process.env[key] : '';
    }
    throw new Error(`Unknown replacement: ${replacement}`);
}

/**
 * @param {import('./ast').Expression} expression
 * @param {Writable} stdout
 * @param {Writable} stderr
 * @param {Readable=} stdin
 * @return {{stdin: Writable, kill: (signal: number) => boolean, closePromise: Promise<number>}}
 */
function execute(expression, stdout, stderr, stdin) {
    if ('executable' in expression) {
        const {executable, args} = processAlias(processWord(expression.executable), [...expression.args.map(processWord)]);
        if (executable in builtins) {
            const closePromise = builtins[executable](args, stdout, stderr);
            return {
                closePromise,
                stdin: new Writable({write(){}}),
                kill: () => void 0,
            }
        } else if (args.length === 0 && treatAsDirectory(executable)) {
            return execute({executable: 'cd', args: [executable]}, stdout, stderr, stdin);
        } else {
            const child = spawn(executable, args, {
                stdio: [stdin === process.stdin ? 'inherit' : 'pipe', stdout === process.stdout ? 'inherit' : 'pipe', stderr === process.stderr ? 'inherit' : 'pipe'],
            });
            const closePromise = new Promise(resolve => {
                child.on('close', resolve);
                child.on('error', err => {
                    stderr.write(err.message + '\n');
                    resolve(127);
                });
            });
            if (stdin !== process.stdin && stdin)
                stdin.pipe(child.stdin, { end: false });
            if (stderr !== process.stderr)
                child.stderr.pipe(stderr, { end: false });
            if (stdout !== process.stdout)
                child.stdout.pipe(stdout, { end: false });
            return {stdin: child.stdin, kill: child.kill.bind(child), closePromise};
        }
    } else if ('pipe' in expression) {
        const pipe = execute(expression.pipe, stdout, stderr);
        const main = execute(expression.main, pipe.stdin, stderr, stdin);
        const closePromise = main.closePromise.then(() => {
            pipe.stdin.end();
            return pipe.closePromise;
        });
        return {stdin: main.stdin, kill: main.kill, closePromise};
    } else if ('left' in expression) {
        const writableStdin = new Writable({
            write(chunk, encoding, callback) {
                active.stdin.write(chunk, encoding, callback);
            }
        });
        const left = execute(expression.left, stdout, stderr, stdin);
        let active = left;
        const closePromise = left.closePromise.then(async code => {
            if (!!code === (expression.type === 'or')) {
                const right = execute(expression.right, stdout, stderr, stdin);
                active = right;
                return right.closePromise;
            }
            return code;   
        });
        return {stdin: writableStdin, kill: (...args) => active.kill(...args), closePromise};
    }
}

function arrayWriter(datas) {
    return new Writable({
        write(chunk, encoding, callback) {
            datas.push(chunk);
            callback();
        }
    })
}

/**
 * @param {import('./ast').Expression} expression
 */
async function getResult(expression) {
    const errs = [];
    const errStream = arrayWriter(errs);
    const datas = [];
    const outStream = arrayWriter(datas);
    const {closePromise, stdin} = execute(expression, outStream, errStream);
    stdin.end();
    const code = await closePromise;
    const output = Buffer.concat(datas).toString();
    const stderr = Buffer.concat(errs).toString();
    return {output, stderr, code};
}

function getChanges() {
    return changes;
}

module.exports = {execute, getResult, getChanges};
