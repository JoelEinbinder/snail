import { parse } from '../slug/shjs/parser';
import { tokenize } from '../slug/shjs/tokenizer';
import { makeWebExecutor } from './makeWebExecutor';
import { runtimeHandler, hookConsole } from './runtimeHandler';
import { dungeon } from './dungeon';
import { JoelEvent } from '../slug/cdp-ui/JoelEvent';

function dispatch(message) {
  self.postMessage(message);
}
dungeon.dispatch = dispatch;

// hookConsole(dispatch);

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

const process = { cwd: () => dungeon.cwd.current, env: {} };
const { execute, aliases, env } = makeWebExecutor();
process.env = env;
//@ts-ignore
self.process = process;
//@ts-ignore
self.player = Object.freeze({
  get hp() { return dungeon.player.stats.hp },
  get attack() { return dungeon.player.stats.attack },
  get spAttack() { return dungeon.player.stats.spAttack },
  get defense() { return dungeon.player.stats.defense },
  get spDefense() { return dungeon.player.stats.spDefense },
  get speed() { return dungeon.player.stats.speed },
  get moves() { return [...dungeon.player.stats.moves.map(x => x.name)] },
  get element() { return dungeon.player.stats.type.join('/') },
  get items() { return Object.fromEntries(dungeon.player.items.entries()) },
});

const stdin = new JoelEvent<string>('');
self['bootstrap'] = function(args, { bytes }) {
  dungeon.player.bytes = bytes;
  
  const stdout = createTerminalStream();
  setTimeout(async () => {
    await dungeon.reset(stdout, stdout, stdin);
    stdout.end();
  }, 0)
  return (message) => {
    // TODO do something with 'resize'?
    // TODO handle 'input'
    if (message.method === 'input' && message.params.id === terminalId)
      stdin.dispatch(message.params.data);
  };
};

let terminalId = 0;
function createTerminalStream() {
  const id = ++terminalId;
  notify('startTerminal', {id});
  return {
    _ended: false,
    write(data, encoding, callback?) {
      notify('data', {id, data});
      callback?.();
    },
    end() {
      if (this._ended)
        return;
      this._ended = true;
      notify('endTerminal', {id});
    },
  };
}

self['pty'] = async function(command) {
  const {tokens} = tokenize(command);
  const ast = parse(tokens);
  const stdout = createTerminalStream();
  const { closePromise, kill } = execute(ast, stdout, stdout, stdin);
  let waitForDoneCallback;
  
  const waitForDonePromise = new Promise(x => waitForDoneCallback = x);
  // /** @type {{exitCode: number, died?: boolean, signal?: number, changes?: Changes}} */
  // const returnValue = await Promise.race([
  //   new Promise(x => shell.onExit(value => {x({...value, died: true}); waitForDoneCallback()})),
  //   connectionDonePromise,
  // ]);
  const returnValue = { exitCode: await closePromise};
  // if (returnValue.changes) {
  //   const changes = returnValue.changes;
  //   if (changes.cwd) {
  //     origChangeDir(changes.cwd);
  //     notify('cwd', changes.cwd);
  //   }
  //   if (changes.env) {
  //     for (const key in changes.env) {
  //       process.env[key] = changes.env[key];
  //     }
  //     notify('env', changes.env);
  //   }
  //   if (changes.aliases) {
  //     notify('aliases', changes.aliases);
  //     for (const key of Object.keys(changes.aliases)) {
  //       setAlias(key, changes.aliases[key]);
  //     }
  //   }
  //   if (changes.nod)
  //     notify('nod', changes.nod);
  //   if (changes.ssh)
  //     notify('ssh', changes.ssh);
  //   if (changes.reconnect)
  //     notify('reconnect', changes.reconnect);
  //   if (changes.code)
  //     notify('code', changes.code);
  //   if (changes.exit !== undefined) {
  //     process.exit(changes.exit);
  //   }
  // worker.postMessage(changes);
  stdout.end();
  return 'this is the secret secret string:' + returnValue.exitCode;
}

dungeon.cwd.on(cwd => {
  dispatch({ method: 'Shell.cwdChanged', params: { cwd }});
})
dungeon.bytesEvent.on(() => {
  dispatch({ method: 'Game.setBytes', params: dungeon.player.bytes });
});


self['__getResult__'] = async function (command) {
  const outStream = {
    write(data, encoding, callback?) {
      datas.push(data);
      callback?.();
    },
    end() {
    },
  };
  const errStream = {
    write(data, encoding, callback?) {
      errs.push(data);
      callback?.();
    },
    end() {
    },
  };
  const errs = [];
  const datas = [];
  const {tokens} = tokenize(command);
  const ast = parse(tokens);
  const {closePromise, stdin} = execute(ast, outStream, errStream);
  stdin?.end();
  const code = await closePromise;
  const result = datas.join('');
  const stderr = errs.join('');
  return {result, stderr, exitCode: code};
}
function notify(method: string, params: any) {
  dispatch({ method: 'Shell.notify', params: { payload: {method, params} }});
}
//@ts-ignore
self.global = self;
export {}