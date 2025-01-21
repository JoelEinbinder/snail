import type { IHostAPI } from '../src/host';
import type { ShellHost } from '../host/ShellHost';
import { ClientMethods } from '../src/JSConnection';
import { RPC, type Transport } from '../slug/protocol/RPC-ts';
import { preprocessTopLevelAwaitExpressions } from './top-level-await';
import doorbell from './trick-or-treat/Sound_Effect_-_Door_Bell.ogg'
import gameIframe from './game-iframe.html';
const sounds = {
  doorbell: new Audio(new URL(doorbell, import.meta.url).href),
};
export class GameHost implements IHostAPI {
  private _game: Game = new Game((eventName, events) => {
    this._listeners.get(eventName)?.forEach(listener => listener(events));
  });
  private _listeners = new Map<string, Set<(value: any) => void>>();
  async sendMessage<Key extends keyof ShellHost>(message: { method: Key; params?: Parameters<ShellHost[Key]>[0] | undefined; }): Promise<ReturnType<ShellHost[Key]>> {
    if (!(message.method in this._game))
      throw new Error('Unknown method: ' + message.method);
    // @ts-ignore
    return this._game[message.method](message.params);
  }
  notify<Key extends keyof ShellHost>(message: { method: Key; params?: Parameters<ShellHost[Key]>[0] | undefined; }): void {
    this.sendMessage(message);
  }
  onEvent(eventName: string, listener: (event: any) => void) {
    if (!this._listeners.has(eventName))
      this._listeners.set(eventName, new Set());
    this._listeners.get(eventName)!.add(listener);
  }
  type(): string {
    return 'game';
  }
}
type ShellHostInterface = {
  [Key in keyof ShellHost]?: (params: Parameters<ShellHost[Key]>[0]) => Promise<ReturnType<ShellHost[Key]>>;
};
let lastWebSocketId = 0;
class Game implements ShellHostInterface {
  private _shells = new Map<number, ShellHandler>();
  constructor(private _sendEvent: (eventName: string, data: any) => void) {}
  async obtainWebSocketId() {
    return ++lastWebSocketId;
  }
  async createJSShell(params: { cwd: string; socketId: number; }): Promise<{ nodePath: string; bootstrapPath: string; }> {
    this._shells.set(params.socketId, makeGameShellHandler((eventName: string, data: any) => this._sendEvent('websocket', { socketId: params.socketId, message: { method: eventName, params: data } })));
    return {
      bootstrapPath: '',
      nodePath: '',
    }
  }
  async reportTime(params: { name: string; }) {
  }
  async loadItem(params: { key: string; }): Promise<any> {
    return JSON.parse(localStorage.getItem('snail_game_' + params.key) || 'null');
  }
  async saveItem(params: { key: string; value: any }) {
    localStorage.setItem('snail_game_' + params.key, JSON.stringify(params.value));
    return 0;
  }
  async sendMessageToWebSocket({socketId, message}: { socketId: number; message: { method: string; params: any; id: number; }; }): Promise<void> {
    const shell = this._shells.get(socketId);
    try {
      if (!(message.method in shell))
        throw new Error('Unknown method: ' + message.method);
      const result = await shell[message.method](message.params);

      if (message.id)
        this._sendEvent('websocket', { socketId, message: { id: message.id, result }});
    } catch(error) {
      if (message.id)
        this._sendEvent('websocket', { socketId, message: { id: message.id, error }});
      else
        console.error(error);
    }
  }
  async focusMainContent() { }
  async addHistory() { return -1 }
  async updateHistory() { return -1 }
  async queryDatabase(params: { sql: string; params: any[]; }): Promise<any[]> {
    if (params.sql === 'SELECT MAX(command_id) FROM history')
      return [{ 'MAX(command_id)': 0 }];
    return [];
  }
  async destroyWebsocket(params: { socketId: number; }): Promise<void> {
    this._shells.delete(params.socketId);
  }
  async close() { }
  async beep() { }
  async urlForIFrame(params: {shellIds: number[], filePath: string}) {
    const url = new URL(gameIframe, import.meta.url);
    url.searchParams.set('game', '1');
    url.searchParams.set('iframe', params.filePath);
    return url.href;
  };
}
type ShellHandler = {
  [Key in keyof ClientMethods]?: (params: Parameters<ClientMethods[Key]>[0]) => Promise<ReturnType<ClientMethods[Key]>>;
};
let bytes = parseInt(localStorage.getItem('snail_game_bytes') || '0');
let lastStreamId = 0;
function makeGameShellHandler(sendEvent: (eventName: string, data: any) => void): ShellHandler {
  const url = new URL('../game/game.worker.js', import.meta.url);
  let lastPreviewToken = 0;
  let bootstrapFunctionId: number|null = null;
  const previewResults = new Map<number, any>();
  const worker = new Worker(url.href, {type: 'module'});
  const transport: Transport = {
    send(message) {
        worker.postMessage(message);
    }
  };
  const workerRPC = new RPC(transport);
  worker.addEventListener('message', event => {
    if (event.data.method === 'Shell.notify') {
      const { previewToken } = event.data.params.payload.params;
      if (previewToken) {
        const notifications = previewResults.get(previewToken);
        if (notifications) {
          notifications.push(event.data.params.payload);
          return;
        }
      }
    }
    transport.onmessage(event.data);
  });
  for (const event of ['Runtime.consoleAPICalled', 'Runtime.executionContextCreated', 'Runtime.exceptionThrown', 'Shell.notify'])
    workerRPC.on(event as never, data => sendEvent(event, data));
  
  workerRPC.on('Game.setBytes' as never, data => {
    bytes = data as number;
    localStorage.setItem('snail_game_bytes', String(bytes));
  });
  workerRPC.on('Game.playSound' as never, data => {
    const sound = sounds[data['sound']];
    sound.loop = data['loop'];
    sound?.play();
  });
  return {
    'Shell.enable': async params => {
      await workerRPC.send('Runtime.enable', {});
      const {result: {objectId}} = await workerRPC.send('Runtime.evaluate', {
        expression: `bootstrap(${JSON.stringify(params.args)}, ${JSON.stringify({ bytes })})`,
        awaitPromise: true,
      });
      bootstrapFunctionId = objectId;
      await workerRPC.send('Runtime.callFunctionOn', {
        objectId: bootstrapFunctionId,
        functionDeclaration: `function(data) { return this(data); }`,
        awaitPromise: true,
        arguments: [{
          value: {method: 'reset'}
        }]
      });
    },
    'Shell.resize': async (params) => {
    },
    'Shell.input': async ({data, id}) => {
      await workerRPC.send('Runtime.callFunctionOn', {
        objectId: bootstrapFunctionId,
        functionDeclaration: `function(data) { return this(data); }`,
        awaitPromise: true,
        arguments: [{
          value: {method: 'input', params: {data, id}}
        }]
      });
  
    },
    'Protocol.abort': async params => {
    },
    'Shell.previewShellCommand': async ({command}) => {
      const previewToken = ++lastPreviewToken;
      const notifications = [];
      // const abort = () => workerRPC.send('Runtime.evaluate', {
      //   expression: `global._abortPty(${JSON.stringify(previewToken)})`,
      //   returnByValue: true,
      //   generatePreview: false,
      // }).catch(e => e);
      // signal.addEventListener('abort', abort);
      previewResults.set(previewToken, notifications);
      const result = await workerRPC.send('Runtime.evaluate', {
        expression: `self.pty(${JSON.stringify(command)}, ${JSON.stringify(previewToken)})`,
        awaitPromise: true,
        returnByValue: false,
        generatePreview: true,
        userGesture: true,
        replMode: true,
        allowUnsafeEvalBlockedByCSP: true,
      });
      // signal.removeEventListener('abort', abort);
      previewResults.delete(previewToken);
      return {result, notifications};
    },
    'Shell.evaluate': async ({code}) => {
      const expression = `__getResult__(${JSON.stringify(code)})`;
      const {result, exceptionDetails} = await workerRPC.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        generatePreview: false,
        userGesture: false,
        awaitPromise: true,
        allowUnsafeEvalBlockedByCSP: true,
      });
      if (exceptionDetails)
        throw new Error(exceptionDetails.exception.description);
      return result.value;
    },
    'Shell.previewExpression': async ({expression, language}) => {
      if (language === 'javascript' || language === 'shjs') {
        const result = await workerRPC.send('Runtime.evaluate', {
          expression,
          replMode: true,
          returnByValue: false,
          generatePreview: true,
          userGesture: true,
          allowUnsafeEvalBlockedByCSP: true,
          throwOnSideEffect: (/^[\.A-Za-z0-9_\s]*$/.test(expression) && !expression.includes('debugger')) ? false : true,
          timeout: 1000,
          objectGroup: 'eager-eval',
        });
        void workerRPC.send('Runtime.releaseObjectGroup', {
          objectGroup: 'eager-eval',
        });
        if (result.exceptionDetails) {
          if (result.exceptionDetails?.exception?.className === 'SyntaxError')
            return null;
          if (result.exceptionDetails?.exception?.className === 'EvalError')
            return null;
          if (result.exceptionDetails?.exception?.className === 'ReferenceError')
            return null;
        }
        return result.exceptionDetails ? result.exceptionDetails.exception : result.result;
      } else {
        throw new Error('Unsupported preview language: ' + language);
      }
    },
  

  'Shell.evaluateStreaming': async (params) => {
    const streamId = ++lastStreamId;
    const { code } = params;
    // make sure the streamId is sent before any evaluateStreamData comes in.
    setTimeout(async () => {
      const expression = `__getResult__(${JSON.stringify(code)})`;
      const {result, exceptionDetails} = await workerRPC.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        generatePreview: false,
        userGesture: false,
        awaitPromise: true,
        allowUnsafeEvalBlockedByCSP: true,
      });
      sendEvent('Shell.evaluateStreamingData', {streamId, data: result.value.result});
      sendEvent('Shell.evaluateStreamingEnd', {streamId});
    }, 0);
    return { streamId };
  },
  'Shell.runCommand': async ({command, expression}) => {
      let transformedExpression =  expression;
      if (expression.includes('await')) {
        try {
          transformedExpression = await preprocessTopLevelAwaitExpressions(expression);
          if (transformedExpression === null)
            transformedExpression = expression;
        } catch (error) {
          // let chromium return the error;
        }
      }
      return workerRPC.send('Runtime.evaluate', {
        expression: transformedExpression,
        returnByValue: false,
        generatePreview: true,
        userGesture: true,
        awaitPromise: true,
        allowUnsafeEvalBlockedByCSP: true,
      });
    },
    'Runtime.callFunctionOn': async params => {
      return workerRPC.send('Runtime.callFunctionOn', params);
    },
    'Runtime.evaluate': async params => {
      return workerRPC.send('Runtime.evaluate', params);
    },
    'Runtime.releaseObjectGroup': async params => {
      return workerRPC.send('Runtime.releaseObjectGroup', params);
    },
    'Runtime.getProperties': async params => {
      return workerRPC.send('Runtime.getProperties', params);
    },
    'Runtime.globalLexicalScopeNames': async params => {
      return workerRPC.send('Runtime.globalLexicalScopeNames', params);
    },
  }
}
