import { runtimeHandler } from './runtimeHandler';
console.log('game bundle');

function dispatch(message) {
  self.postMessage(message);
}

self.addEventListener('message', event => {
  protocol(event.data);
});

async function protocol(message) {
  const { method, id, params = {} } = message;
  try {
    const result = await runtimeHandler[method](params, dispatch);
    dispatch({ id, result });
  } catch (error) {
    console.log('protocol', error);
    dispatch({ id, error });
  }
}

// function overrideConsoleAPI(method, type) {
//   var original = console[method];
//   console[method] = function(...args) {
//     original.call(console, ...args);
//     if (method === 'assert'){
//       if (args[0])
//         return;
//       args.shift();
//     }
//     sendEvent('Runtime.consoleAPICalled', {
//       type,
//       args: args.map(arg => makeRemoteObject(arg)),
//       executionContextId: 1,
//       timestamp: Date.now()
//     })
//   }
// }

// overrideConsoleAPI('log', 'log');
// overrideConsoleAPI('debug', 'debug');
// overrideConsoleAPI('info', 'info');
// overrideConsoleAPI('error', 'error');
// overrideConsoleAPI('warn', 'warning');
// overrideConsoleAPI('dir', 'dir');
// overrideConsoleAPI('dirxml', 'dirxml');
// overrideConsoleAPI('table', 'table');
// overrideConsoleAPI('trace', 'trace');
// overrideConsoleAPI('clear', 'clear');
// overrideConsoleAPI('group', 'startGroup');
// overrideConsoleAPI('groupCollapsed', 'startGroupCollapsed');
// overrideConsoleAPI('groupEnd', 'endGroup');
// overrideConsoleAPI('assert', 'assert');
// overrideConsoleAPI('profile', 'profile');
// overrideConsoleAPI('profileEnd', 'profileEnd');
// overrideConsoleAPI('count', 'count');
// overrideConsoleAPI('timeEnd', 'timeEnd');

globalThis.process = {
  env: {},
  cwd: () => '/', 
};

self.bootstrap = function() {
  return (message) => {
    console.log('bootstrap message', message);
  };
}

export {}