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

test('pty should keep wokring after an abort', async ({runtime}) => {
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

test('pty should close on ctrl+c', async ({runtime}) => {
    test.setTimeout(5000);
    const ptyPromise = runtime.pty('sleep 1000');
    runtime.setNotify(method => {
        if (method === 'startTerminal')
            runtime.respond({method: 'input', params: { data: '\u0003'}});
    });
    await ptyPromise;
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

