// unit tests for runtime.js
import type { Runtime } from '../slug/shell/runtime-types';
import { test, expect } from './fixtures';

test('pty should work', async ({runtime}) => {
    expect(await runtime.pty('echo 123')).toBe('this is the secret secret string:0');
});

test('pty should abort', async ({runtime}) => {
    const ptyPromise = runtime.pty('sleep 1000', 55);
    runtime.abortPty(55);
    await ptyPromise;
});

test('pty should abort after a delay', async ({runtime}) => {
    const ptyPromise = runtime.pty('sleep 1000', 55);
    setTimeout(() => runtime.abortPty(55), 100);
    await ptyPromise;
});

test('pty should keep working after an abort', async ({runtime}) => {
    test.setTimeout(5000);
    const ptyPromise = runtime.pty('sleep 1000', 55);
    setTimeout(() => runtime.abortPty(55), 100);
    await ptyPromise;
    expect(await runtime.pty('echo 123')).toBe('this is the secret secret string:0')
});

test('pty should do stdin', async ({runtime}) => {
    runtime.setNotify(method => {
        if (method === 'startTerminal')
            runtime.respond({method: 'input', params: { data: 'foo\n'}});
    })
    await runtime.pty('read');
});

test('pty should close on SIGINT ctrl+c', async ({runtime}) => {
    test.setTimeout(5000);
    const ptyPromise = runtime.pty('sleep 1000');
    runtime.setNotify(method => {
        if (method === 'startTerminal')
            runtime.respond({method: 'input', params: { data: '\u0003'}});
    });
    expect(await ptyPromise).toBe('this is the secret secret string:130');
});

test('pty should ctrl+c after nano', async ({runtime}) => {
    test.setTimeout(5000);
    runtime.setNotify(method => {
        if (method === 'startTerminal')
            runtime.respond({method: 'input', params: { data: '\u0018'}});
    });
    const nanoPromise = runtime.pty('nano');
    await nanoPromise;
    runtime.setNotify(method => {
        if (method === 'startTerminal')
            runtime.respond({method: 'input', params: { data: '\u0003'}});
    });
    const sleepPromise = runtime.pty('sleep 1000');
    await sleepPromise;
});

test('pty should close on SIGQUIT ctrl+/', async ({runtime}) => {
    test.setTimeout(5000);
    const ptyPromise = runtime.pty('sleep 1000');
    runtime.setNotify(method => {
        if (method === 'startTerminal')
            runtime.respond({method: 'input', params: { data: '\u001c'}});
    });
    expect(await ptyPromise).toBe('this is the secret secret string:131');
});

test('pty should not wait for input in preview', async ({ runtime }) => {
    expect(await runtime.pty('cat', 1), 'this is the secret secret string:0');
});

test('pty should fail unfinished command', async ({ runtime }) => {
    expect(await runtime.pty('echo foo |', 1), 'this is the secret secret string:0');
});

test('pty should finish grepping nothing', async ({ runtime }) => {
    expect(await runtime.pty('echo foo | grep', 1), 'this is the secret secret string:0');
});

test('pty can preview ps aux piped nowhere', async ({ runtime }) => {
    expect(await runtime.pty('ps aux |', 1), 'this is the secret secret string:0');
});

test('pty can preview ps aux piped to head', async ({ runtime }) => {
    expect(await runtime.pty('ps aux | head', 1), 'this is the secret secret string:0');
});

test('should still work after a syntax error', async ({ runtime }) => {
    expect(await runtime.pty('&', 1), 'this is the secret secret string:1');
    expect(await runtime.pty('echo foo'), 'this is the secret secret string:0');
});
