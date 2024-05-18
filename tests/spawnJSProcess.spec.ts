import { test, expect } from './fixtures';
import { spawnJSProcess } from '../slug/shell/spawnJSProcess';
import {homedir} from 'os';
test('spawnJSProcess', async ({}) => {
  const {socketPromise, err} = spawnJSProcess({
    cwd: null,
    nodePath: process.execPath,
    bootstrapPath: require.resolve('../slug/shell/bootstrap.js'),
  });
  err?.pipe(process.stderr);
  const socket = await socketPromise;
  await socket.readyPromise;
  const cwdMessage = await new Promise<{data: string}>(x => socket.onmessage = x);
  expect(JSON.parse(cwdMessage.data)).toEqual(
    {"method":"Shell.notify","params":{"payload":{"method":"cwd","params": homedir()}}}
  );
  const responsePromise = new Promise<{data: string}>(x => socket.onmessage = x);
  socket.send(JSON.stringify({
    id: 1,
    method: 'Schema.getDomains',
    params: {},
  }));
  const response = await responsePromise;
  expect(JSON.parse(response.data)).toEqual({
    id: 1,
    result: {
      domains: [
        {name: 'Runtime', version: '1.3'},
        {name: 'Debugger', version: '1.3'},
        {name: 'Profiler', version: '1.3'},
        {name: 'HeapProfiler', version: '1.3'},
        {name: 'Schema', version: '1.3'},
      ],
    },
  });
  socket.close();
});
