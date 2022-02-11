const {spawn} = require('child_process');
const {Writable, Readable} = require('stream');
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
        if (expression.executable in builtins) {
            const closePromise = builtins[expression.executable](expression.args, stdout, stderr);
            return {
                closePromise,
                stdin: new Writable({write(){}}),
                kill: () => void 0,
            }
        } else {
            const child = spawn(expression.executable, expression.args, {
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
