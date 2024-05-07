// unit tests for runtime.js
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

test('pty should do stdin', async ({runtime}) => {
    runtime.setNotify((method, params) => {
        if (method === 'startTerminal')
            runtime.respond({method: 'input', params: { id: params.id, data: 'foo\n'}});
    })
    await runtime.pty('read');
});

