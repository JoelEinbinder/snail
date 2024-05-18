const {spawn, spawnSync, exec} = require('child_process');
const {Writable, Readable} = require('stream');
const fs = require('fs');
const path = require('path');
const pathService = require('../path_service/');

/**
 * @type {{
 * env?: {[key: string]: string},
 * aliases?: {[key: string]: string[]},
 * cwd?: string,
 * nod?: string[],
 * ssh?: { sshAddress: string, sshArgs: string[], env: NodeJS.ProcessEnv },
 * reconnect?: string,
 * code?: string,
 * exit?: number,
 * }}
 */
let changes = null;

/** @type {Object<string, (args: string[], stdout: Writable, stderr: Writable, stdin: Readable, env: NodeJS.ProcessEnv) => Promise<number>|'pass'>} */
const builtins = {
    cd: async (args, stdout, stderr) => {
        try {
            let [dir = pathService.homedir()] = args;
            if (dir === '-') {
                if (!process.env.OLDPWD) {
                    stderr.write('cd: OLDPWD not set\n');
                    return 1;
                }
                dir = process.env.OLDPWD;
                stdout.write(dir + '\n');
            }
            const oldDir = process.cwd();
            process.chdir(dir);
            if (!changes)
                changes = {};
            changes.cwd = process.cwd();
            process.env.PWD = process.cwd();
            process.env.OLDPWD = oldDir;
            if (!changes.env)
                changes.env = {};
            changes.env.PWD = process.cwd();
            changes.env.OLDPWD = oldDir;
        } catch (e) {
            if (e?.code === 'ENOENT') {
                stderr.write(`cd: No such file or directory '${e.dest}'\n`);
                return 1;
            }
            stderr.write(e.message + '\n');
            return 1;
        }
        return 0;
    },
    ls: (args, stdout, stderr) => {
        if (stdout !== process.stdout || args.some(x => x.startsWith('-') && /[^\-la]/.test(x)))
            return 'pass';
        return require('../apps/ls/lib').run(args, stdout, stderr);
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
    declare: (args, stdout, stderr, stdin, env) => {
        if (args[0] !== '-x') {
            stderr.write('declare is only supported with -x\n');
            return Promise.resolve(1);
        }
        return builtins.export(args.slice(1), stdout, stderr, stdin, env);
    },
    alias: async (args, stdout, stderr) => {
        if (!args[0]) {
            stdout.write(JSON.stringify(aliases, undefined, 2) + '\n');
            return 0;
        }
        aliases[args[0]] = args.slice(1);
        if (!changes)
            changes = {};
        if (!changes.aliases)
            changes.aliases = {};
        changes.aliases[args[0]] = args.slice(1);
        return 0;
    },
    nod: async (args, stdout, stderr) => {
        for (const arg of args) {
            if (arg === '--version') {
                stdout.write(process.version + '\n');
                return 0;
            } else if (arg === '--help') {
                stdout.write(`nod help unimplemented\n`);
                return 0;
            }
        }
        if (!changes)
            changes = {};
        changes.nod = args;
        return 0;
    },
    ssh2: (args, stdout, stderr, stdin, env) => {
        if (stdout !== process.stdout)
            return 'pass';
        let address = null;
        const nonAddressArgs = [];
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '-o') {
                i++;
                const option = args[i];
                if (!option)
                    return 'pass';
                nonAddressArgs.push(arg, option);
            } else if (arg === '-p') {
                i++;
                const port = args[i];
                if (!port)
                    return 'pass';
                nonAddressArgs.push(arg, port);
            } else if (arg === '-L' || arg === '-R') {
                // TODO doesn't support 0 port.
                // Should either catch and report it or
                // pass to the real ssh.
                i++;
                const forwarding = args[i];
                if (!forwarding)
                    return 'pass';
                nonAddressArgs.push(arg, forwarding);
            } else if (arg.startsWith('-')) {
                // unknown option
                return 'pass';
            } else if (!address) {
                address = arg;
            } else {
                // too many arguments
                return 'pass';
            }
        }
        if (!address)
            return 'pass';
        if (!changes)
            changes = {};
        changes.ssh = { sshAddress: address, sshArgs: nonAddressArgs, env };
        return Promise.resolve(0);
    },
    reconnect: async (args, stdout, stderr) => {
        if (!changes)
            changes = {};
        const socketDir = path.join(pathService.tmpdir(), 'snail-sockets');
        if (args.includes('--list')) {
            const quiet = args.includes('--quiet');
            const metadataStrings = (await fs.promises.readdir(socketDir)).filter(x => x.endsWith('.json'));
            /** @type {import('../shell/metadata').Metadata[]} */
            const metadatas = [];
            for (const metadataString of metadataStrings) {
                const jsonString = await fs.promises.readFile(path.join(socketDir, metadataString), 'utf8');
                try {
                    /** @type {import('../shell/metadata').Metadata} */
                    const metadata = JSON.parse(jsonString);
                    if (quiet) {
                        if (!metadata.connected)
                            return 0;
                    } else {
                        metadatas.push(metadata);
                    }
                } catch (e) {
                    console.error('failed to parse', {jsonString});
                    throw e;
                }
            }
            if (quiet)
                return 1;
            const sdk = require('../sdk');
            sdk.display(path.join(__dirname, '..', 'apps', 'reconnect', 'web.ts'));
            sdk.send(metadatas);
            return 0;
        } else if (args.length) {
            changes.reconnect = path.resolve(process.cwd(), args[0]);
        } else {
            const entries = (await fs.promises.readdir(socketDir)).filter(x => x.endsWith('.socket'));
            if (entries.length === 0) {
                stderr.write('No daemons found to reconnect to.\n');
                return 1;
            }
            changes.reconnect = path.join(socketDir, entries[0]);
        }
        return 0;
    },
    code: (args, stdout, stderr, stdin, env) => {
        if (!('SSH_CONNECTION' in env || 'SSH_CLIENT' in env))
            return 'pass';
        if (args.length !== 1 || args[0].startsWith('-'))
            return 'pass';
        if (!changes)
            changes = {};
        changes.code = path.resolve(process.cwd(), args[0]);
        return Promise.resolve(0);
    },
    exit: async (args, stdout, stderr) => {
        if (!changes)
            changes = {};
        changes.exit = args.length ? parseInt(args[0]) : 0;
        return 0;
    },
    source: async(args, stdout, stderr) => {
        return runBashAndExtractEnvironment('source', args[0], stdout, stderr);
    },
    'bash-eval': async(args, stdout, stderr) => {
        return runBashAndExtractEnvironment('eval', args[0], stdout, stderr);
    },
    __git_ref_name: async (args, stdout, stderr, stdin, inEnv) => {
        const env = {
            ...inEnv,
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
    __is_git_dirty: async (args, stdout, stderr, stdin, inEnv) => {
        const env = {
            ...inEnv,
            GIT_OPTIONAL_LOCKS: '0',
        };
        const isGit = spawnSync('git', ['rev-parse', '--git-dir'], { env });
        if (isGit.status)
            return 0;
        const status = spawnSync('git', ['status', '--porcelain'], { env });
        if (status.status)
            return 0;
        if (!status.stdout)
            return 0;
        if (status.stdout.toString().trim())
            stdout.write("dirty\n");
        return 0;
    },
    __npx_completions: async (args, stdout, stderr, stdin, env) => {
        let dir = process.cwd();
        while (true) {
            const status = spawnSync('find', ['-L', '.', '-type', 'f', '-perm', '+111'], {
                cwd: path.join(dir, 'node_modules', '.bin'),
                env,
            });
            if (status.status === 0) {
                const data = status.stdout.toString().split('\n').map(x => {
                    if (x.startsWith('./'))
                        return x.substring('./'.length);
                    return x;
                }).join('\n');
                stdout.write(data);
            }
            if (dir === '/')
                break;
            dir = path.join(dir, '..');
        }
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
        await Promise.all(env.PATH.split(':').map(async dir => {
            const names = await fs.promises.readdir(dir).catch(e => []);
            for (const name of names) {
                try {
                    const stat = fs.statSync(path.join(dir, name));
                    if (stat.mode & 0o111 && !stat.isDirectory())
                        stdout.write(name + '\n');
                } catch { }
            }
        }));
        return 0;
    },
    __file_completions: async (args, stdout, stderr) => {
        const type = args[0];
        const dir = path.resolve(process.cwd(), args[1] || '');
        const names = await fs.promises.readdir(dir).catch(e => []);
        for (const name of names) {
            if (type === 'all') {
                stdout.write(name + '\n');
            } else {
                try {
                    const stat = fs.statSync(path.join(dir, name));
                    if (type === 'directory' && stat.isDirectory())
                        stdout.write(name + '\n');
                    else if (type === 'executable' && stat.mode & 0o111)
                        stdout.write(name + '\n');
                } catch {}
            }
        }
        return 0;
    },
    __command_description: async (args, stdout, stderr) => {
        const name = processAlias(args[0], []).executable;
        if (name in builtins) {
            stdout.write('built in shell command');
            return 0;
        }
        const {descriptionOfCommand} = require('../manpage_reader');
        const description = descriptionOfCommand(name);
        if (description)
            stdout.write(description + '\n');
        return 0;
    },
    __environment_variables: async (args, stdout, stderr, stdin, env) => {
        stdout.write(JSON.stringify(env) + '\n');
        return 0;
    },
    __find_all_files: async (args, stdout, stderr, stdin, env) => {
        const maxFiles = parseInt(args[0] || '1');
        let filesSeen = 0;
        try {
            /**
             * Originally from globby
             * Copyright (c) Sindre Sorhus
             * MIT License
             * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
             */
            const isNegativePattern = pattern => pattern[0] === '!';

            const applyBaseToPattern = (pattern, base) => isNegativePattern(pattern)
                ? '!' + path.posix.join(base, pattern.slice(1))
                : path.posix.join(base, pattern);

            const slash = (path) => {
                const isExtendedLengthPath = path.startsWith('\\\\?\\');
            
                if (isExtendedLengthPath) {
                    return path;
                }
            
                return path.replace(/\\/g, '/');
            };

            const parseIgnoreFile = (file, cwd) => {
                const base = slash(path.relative(cwd, path.dirname(file.filePath)));

                return file.content
                    .split(/\r?\n/)
                    .filter(line => line && !line.startsWith('#'))
                    .map(pattern => applyBaseToPattern(pattern, base));
            };

            const { default: ignore } = require('ignore');
            const gitignore = ignore();
            gitignore.ignores('foo/bar');
            const root = process.cwd();
            const {walkStream} = require('@nodelib/fs.walk');
            const seenIgnores = new Set();
            const updateIgnores = current => {
                while (current !== '/') {
                    current = path.dirname(current);
                    const ignoreFile = path.join(current, '.gitignore');
                    if (seenIgnores.has(ignoreFile))
                        continue;
                    seenIgnores.add(ignoreFile);
                    try {
                        const content = fs.readFileSync(ignoreFile, 'utf8');
                        const parsed = parseIgnoreFile({ content , filePath: ignoreFile }, root);
                        gitignore.add(parsed);
                    } catch {
                        // if the ignore file doesn't exist or something this will throw
                    }
                }
            };
            const stream = walkStream(root, {
                errorFilter: () => true,
                concurrency: 4 * require('os').cpus().length,
                deepFilter: value => {
                    if (value.name === '.git')
                        return false;
                    updateIgnores(value.path);
                    return !gitignore.ignores(path.relative(root, value.path));
                },
                entryFilter: value => {
                    if (value.dirent.isDirectory())
                        return false;
                    updateIgnores(value.path);
                    return !gitignore.ignores(path.relative(root, value.path));
                },
                basePath: root,
            });
            stdin?.once('finish', () => {
                stream.destroy();
            });
            const endPromise = new Promise(x => stream.once('end', x));
            const readPromise = (async () => {
                for await (const file of stream) {
                    stdout.write(path.relative(root, file.path) + '\n');
                    filesSeen++;
                    if (filesSeen >= maxFiles)
                        break;
                }    
            })();
            await Promise.race([endPromise, readPromise]);
            stream.destroy();
        } catch (e) {
            stdout.write(e.message + '\n');
        }
        return 0;
    },
};

/**
 * @param {"eval"|"source"} command
 * @param {string} arg
 * @param {Writable} stdout
 * @param {Writable} stderr
 */
function runBashAndExtractEnvironment(command, arg, stdout, stderr) {
    const magicKey = Math.random().toString();
    const output = spawnSync('bash', ['-c', `env && echo $0 && ${command} $1; echo $0; env;`, magicKey, arg]);
    stderr.write(output.stderr);
    if (output.status)
        return output.status;
    const lines = output.stdout.toString().split('\n').map(x => x.trim()).filter(x => x);
    const index = lines.indexOf(magicKey);
    if (index === -1)
        return 1;
    const oldEnv = new Map();
    for (const line of lines.slice(0, index)) {
        const equals = line.indexOf('=');
        const key = line.substring(0, equals);
        const value = line.substring(equals + 1);
        oldEnv.set(key, value);
    }
    const index2 = lines.indexOf(magicKey, index + 1);
    if (index2 === -1)
        return 1;
    for (const line of lines.slice(index + 1, index2))
        stdout.write(line + '\n');
    const newEnv = new Map();
    for (const line of lines.slice(index2 + 1)) {
        const equals = line.indexOf('=');
        const key = line.substring(0, equals);
        const value = line.substring(equals + 1);
        newEnv.set(key, value);
    }
    const added = new Map();
    for (const [key, value] of newEnv.entries()) {
        if (!oldEnv.has(key))
            added.set(key, value);
        else if (value !== oldEnv.get(key))
            added.set(key, value);
    }
    for (const key of oldEnv.keys()) {
        if (!newEnv.has(key))
            stderr.write(`${key} was removed. Currently unsupported\n`);
    }
    for (const [key, value] of added.entries()) {
        if (!changes)
            changes = {};
        if (!changes.env)
            changes.env = {};
        process.env[key] = value;
        changes.env[key] = value;
    }
    return 0;
}

/** @type {Object<string, string[]>} */
const aliases = {
    'grep': ['grep', '--color=auto', '--exclude-dir={.bzr,CVS,.git,.hg,.svn,.idea,.tox}'],
    'egrep': ['egrep', '--color=auto', '--exclude-dir={.bzr,CVS,.git,.hg,.svn,.idea,.tox}'],
    'fgrep': ['fgrep', '--color=auto', '--exclude-dir={.bzr,CVS,.git,.hg,.svn,.idea,.tox}'],
}

function setAlias(name, value) {
    aliases[name] = value;
}

function setAllAliases(newAliases) {
    for (const key in aliases)
        delete aliases[key];
    for (const key in newAliases)
        aliases[key] = newAliases[key];
}

function getAliases() {
    return {...aliases};
}

/**
 * @param {string} executable
 */
function treatAsDirectory(executable) {
    const result = spawnSync('which', ['-s', executable]);
    if (result.status === 0)
        return false;
    try {
        return fs.statSync(executable).isDirectory();
    } catch {
        return false;
    }
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

class UserError extends Error {}

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
        const glob = require('fast-glob');
        const globStr = parts.map(p => typeof p === 'string' ? glob.escapePath(p) : p.glob).join('');
        const output = glob.sync(globStr, {
            onlyFiles: false,
        });
        if (!output.length)
            throw new UserError(`No matches found: ${globStr}`);
        return output;
    }
    return [parts.join('')];
}

/**
 * @param {string} replacement
 */
function computeReplacement(replacement) {
    if (replacement === '~')
        return process.env.HOME || pathService.homedir();
    if (replacement === '~+')
        return process.cwd();
    if (replacement === '~-')
        return process.env.OLDPWD || '~-';
    if (replacement.startsWith('$')) {
        const key = replacement.substring(1);
        return key in process.env ? process.env[key] : '';
    }
    throw new Error(`Unknown replacement: ${replacement}`);
}

const safeExecutables = buildSafeExecutables([
    {name: 'cat'},
    {name: 'ls'},
    {name: 'pwd'},
    {name: 'echo'},
    {name: 'diff'},
    {name: 'head'},
    {name: 'tail'},
    {name: 'ps'},
    {name: 'who'},
    {name: 'whoami'},
    {name: 'id'},
    {name: 'date'},

    // possibly slow
    {name: 'grep'},
    {name: 'du'},
    {name: 'sleep'},
    {name: 'find'},
    {name: 'wc'},
    {name: 'sort'},
    {name: 'uniq'},
    {name: 'cut'},
    {name: 'tr'},
    {name: 'sed'},
    {name: 'awk'},



    // only some args
    {name: 'git', arg: 'status'},
    {name: 'git', arg: '--help'},
    {name: 'python', arg: '-V'},
    {name: 'python', arg: '--version'},
    {name: 'python', arg: '--help'},
    {name: 'python3', arg: '-V'},
    {name: 'python3', arg: '--version'},
    {name: 'python3', arg: '--help'},
    {name: 'node', arg: '--version'},
    {name: 'node', arg: '-v'},
    {name: 'node', arg: '--help'},
    {name: 'npm', arg: '--version'},
    {name: 'npm', arg: '-v'},

    // snail apps
    {name: 'show'},
    {name: 'xkcd'},
])

/**
 * @param {{name: string, arg?: string}[]} descriptor
 * @return {Map<string, { args: Set<string|undefined>}>}
 */
function buildSafeExecutables(descriptor) {
    const map = new Map();
    for (const {name, arg} of descriptor) {
        let entry = map.get(name);
        if (!entry) {
            entry = {args: new Set()};
            map.set(name, entry);
        }
        entry.args.add(arg);
    }
    return map;

}

/**
 * @param {NodeJS.Signals} signal
 * @return {number}
 */
function signalToCode(signal) {
    /** @type {{[key in NodeJS.Signals]: number}} */
    const signals = {
        SIGHUP: 1, //     Terminate   Hang up controlling terminal or      Yes
        SIGINT: 2, //     Terminate   Interrupt from keyboard, Control-C   Yes
        SIGQUIT: 3, //    Dump        Quit from keyboard, Control-\        Yes
        SIGILL: 4, //     Dump        Illegal instruction                  Yes
        SIGTRAP: 5, //    Dump        Breakpoint for debugging             No
        SIGABRT: 6, //    Dump        Abnormal termination                 Yes
        SIGIOT: 6, //     Dump        Equivalent to SIGABRT                No
        SIGBUS: 7, //     Dump        Bus error                            No
        SIGFPE: 8, //     Dump        Floating-point exception             Yes
        SIGKILL: 9, //    Terminate   Forced-process termination           Yes
        SIGUSR1: 10, //    Terminate   Available to processes               Yes
        SIGSEGV: 11, //    Dump        Invalid memory reference             Yes
        SIGUSR2: 12, //    Terminate   Available to processes               Yes
        SIGPIPE: 13, //    Terminate   Write to pipe with no readers        Yes
        SIGALRM: 14, //    Terminate   Real-timer clock                     Yes
        SIGTERM: 15, //    Terminate   Process termination                  Yes
        SIGSTKFLT: 16, //  Terminate   Coprocessor stack error              No
        SIGCHLD: 17, //    Ignore      Child process stopped or terminated  Yes
        SIGCONT: 18, //    Continue    Resume execution, if stopped         Yes
        SIGSTOP: 19, //    Stop        Stop process execution, Ctrl-Z       Yes
        SIGTSTP: 20, //    Stop        Stop process issued from tty         Yes
        SIGTTIN: 21, //    Stop        Background process requires input    Yes
        SIGTTOU: 22, //    Stop        Background process requires output   Yes
        SIGURG: 23, //     Ignore      Urgent condition on socket           No
        SIGXCPU: 24, //    Dump        CPU time limit exceeded              No
        SIGXFSZ: 25, //    Dump        File size limit exceeded             No
        SIGVTALRM: 26, //  Terminate   Virtual timer clock                  No
        SIGPROF: 27, //    Terminate   Profile timer clock                  No
        SIGWINCH: 28, //   Ignore      Window resizing                      No
        SIGIO: 29, //      Terminate   I/O now possible                     No
        SIGPOLL: 29, //    Terminate   Equivalent to SIGIO                  No
        SIGPWR: 30, //     Terminate   Power supply failure                 No
        SIGSYS: 31, //     Dump        Bad system call                      No
        SIGUNUSED: 31, //  Dump        Equivalent to SIGSYS                 No

        // windows?!
        SIGBREAK : 2,
        // macos
        SIGINFO: 29,
        // unknown
        SIGLOST: 29, 
    };
    return (signals[signal] || 1) + 128;
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
                throw new UserError('side effect');
            const {executable, args} = processAlias(processWord(expression.executable)[0], expression.args.flatMap(processWord));
            const env = {...process.env};
            if (noSideEffects && expression.assignments?.length)
                throw new UserError('side effect');
            for (const {name, value} of expression.assignments || [])
                env[name] = processWord(value)[0];
            if (noSideEffects) {
                const entry = safeExecutables.get(executable);
                if (!entry)
                    throw new UserError('side effect');
                if (!entry.args.has(undefined) && !entry.args.has(args[0]))
                    throw new UserError('side effect');
            }
            if (executable in builtins) {
                const closePromise = builtins[executable](args, stdout, stderr, stdin, env);
                if (closePromise !== 'pass') {
                    return {
                        closePromise,
                        stdin: createNullWriter(),
                        kill: () => void 0,
                    }
                }
            } 
            if (args.length === 0 && !expression.assignments?.length && treatAsDirectory(executable)) {
                return execute({executable: 'cd', args: [executable], redirects}, noSideEffects, stdout, stderr, stdin);
            } else {
                /** @type {(Readable|Writable|number|undefined|null)[]} */
                const stdio = [stdin, stdout, stderr];
                const openFds = [];
                for (const redirect of redirects || []) {
                    const file = processWord(redirect.to)[0];
                    const fd = fs.openSync(file, {
                        'write': 'w',
                        'append': 'a',
                        'read': 'r',
                    }[redirect.type]);

                    stdio[redirect.from] = fd;
                    openFds.push(fd);
                }
                const defaultStdio = [process.stdin, process.stdout, process.stderr];
                const child = spawn(executable, args, {
                    stdio: stdio.map((stream, index) => {
                        if (typeof stream === 'number' || stream?.['fd'])
                            return stream;
                        if (stream === null)
                            return 'ignore';
                        if (!stream)
                            return 'pipe';
                        if (stream === defaultStdio[index])
                            return 'inherit';
                        return 'pipe';
                    }),
                    env,
                });
                const closePromise = new Promise(resolve => {
                    child.on('close', (code, signal) => {
                        if (code !== null)
                            resolve(code);
                        else
                            resolve(signalToCode(signal))
                    });
                    child.on('error', (/** @type {Error & {code?: string, path?: string}} */ err) => {
                        if (err?.code === 'ENOENT')
                            stderr.write(`command not found: ${err?.path}\n`);
                        else
                            stderr.write(err.message + '\n');
                        resolve(127);
                    });
                });
                closePromise.then(() => {
                    for (const fd of openFds)
                        fs.close(fd);
                });
                for (let i = 0; i < stdio.length; i++) {
                    const stream = stdio[i];
                    if (stream === defaultStdio[i] || typeof stream === 'number' || !stream || stream['fd'])
                        continue;
                    if ('write' in stream)
                        child.stdio[i].pipe(stream, { end: false });
                    else
                        stream.pipe(/** @type {Writable} */(child.stdio[i]), { end: true });
                }
            return {stdin: child.stdin, kill: child.kill.bind(child), closePromise};
            }
        } else if ('pipe' in expression) {
            const pipe = execute(expression.pipe, noSideEffects, stdout, stderr);
            const main = execute(expression.main, noSideEffects, pipe.stdin, stderr, stdin);
            const closePromise = main.closePromise.then(() => {
                pipe.stdin.end();
                return pipe.closePromise;
            });
            return {stdin: main.stdin, kill: (...args) => {
                const result1 = main.kill(...args);
                const result2 = pipe.kill(...args);
                return result1 && result2;
            }, closePromise};
        } else if ('left' in expression) {
            const writableStdin = new Writable({
                write(chunk, encoding, callback) {
                    active.stdin.write(chunk, encoding, callback);
                }
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
    } catch(error) {
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

function createNullWriter() {
    return new Writable({
        write(chunk, encoding, callback) {
            callback();
        }
    });
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
    const {closePromise, stdin} = execute(expression, false, outStream, errStream);
    stdin.end();
    const code = await closePromise;
    const output = Buffer.concat(datas).toString();
    const stderr = Buffer.concat(errs).toString();
    return {output, stderr, code};
}

function getAndResetChanges() {
    const c = changes;
    changes = null;
    return c;
}

module.exports = {execute, getResult, getAndResetChanges, setAlias, getAliases, setAllAliases};
