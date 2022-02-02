//@ts-check
const {spawn} = require('child_process');
const {Duplex, Writable} = require('stream')
/**
 * @param {import('./ast').Expression} expression
 * @param {Writable} stdout
 * @param {Writable} stderr
 * @return {{stdin: Writable, closePromise: Promise<number>}}
 */
function execute(expression, stdout, stderr) {
    if ('executable' in expression) {
        const child = spawn(expression.executable, expression.args, {
            stdio: 'pipe',
        });
        const closePromise = new Promise(resolve => child.on('close', resolve));
        child.stderr.pipe(stderr, { end: false });            
        child.stdout.pipe(stdout, { end: false });
        return {stdin: child.stdin, closePromise};
    } else if ('pipe' in expression) {
        const pipe = execute(expression.pipe, stdout, stderr);
        const main = execute(expression.main, pipe.stdin, stderr);
        const closePromise = main.closePromise.then(() => {
            pipe.stdin.end();
            return pipe.closePromise;
        });
        return {stdin: main.stdin, closePromise};
    } else if ('left' in expression) {
        const left = execute(expression.left, stdout, stderr);
        let active = left;
        const stdin = new Writable({
            write(chunk, encoding, callback) {
                active.stdin.write(chunk, encoding, callback);
            }
        });
        const closePromise = left.closePromise.then(async code => {
            if (!!code === (expression.type === 'or')) {
                const right = execute(expression.right, stdout, stderr);
                active = right;
                return right.closePromise;
            }
            return code;   
        });
        return {stdin, closePromise};
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

module.exports = {execute, getResult};