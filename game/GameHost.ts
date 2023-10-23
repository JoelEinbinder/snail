import type { IHostAPI } from '../src/host';
import type { ShellHost } from '../host/ShellHost';
import { ClientMethods } from '../src/JSConnection';
import { RPC, type Transport } from '../slug/protocol/RPC-ts';
import makeWorker from 'worker-loader!./game.worker';
import { preprocessTopLevelAwaitExpressions } from './top-level-await';
import { } from '../slug/shjs/execute';

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
    const url = new URL('game-iframe.html', self.location.href);
    url.searchParams.set('game', '1');
    url.searchParams.set('iframe', params.filePath);
    return url.href;
  };
}
type ShellHandler = {
  [Key in keyof ClientMethods]?: (params: Parameters<ClientMethods[Key]>[0]) => Promise<ReturnType<ClientMethods[Key]>>;
};
let lastStreamId = 0;
function makeGameShellHandler(sendEvent: (eventName: string, data: any) => void): ShellHandler {
  const worker = makeWorker();
  const transport: Transport = {
    send(message) {
        worker.postMessage(message);
    }
  };
  const workerRPC = new RPC(transport);
  worker.addEventListener('message', event => {
    transport.onmessage(event.data);
  });
  for (const event of ['Runtime.consoleAPICalled', 'Runtime.executionContextCreated', 'Runtime.exceptionThrown', 'Shell.notify', 'Shell.cwdChanged'])
    workerRPC.on(event as never, data => sendEvent(event, data));
  
  return {
    'Shell.enable': async params => {
      await workerRPC.send('Runtime.enable', {});
      const {result: {objectId}} = await workerRPC.send('Runtime.evaluate', {
        expression: `bootstrap(${JSON.stringify(params.args)})`,
        returnByValue: false,
      });
    
      return { objectId };
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

  'Shell.evaluateStreaming': async (params) => {
    console.log(params);
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
