import type { IHostAPI } from '../src/host';
import type { ShellHost } from '../host/ShellHost';
import { ClientMethods } from '../src/JSConnection';
import { RPC, type Transport } from '../slug/protocol/RPC-ts';

export class REPLHost implements IHostAPI {
  private _repl: REPL = new REPL((eventName, events) => {
    this._listeners.get(eventName)?.forEach(listener => listener(events));
  });
  private _listeners = new Map<string, Set<(value: any) => void>>();
  async sendMessage<Key extends keyof ShellHost>(message: { method: Key; params?: Parameters<ShellHost[Key]>[0] | undefined; }): Promise<ReturnType<ShellHost[Key]>> {
    if (!(message.method in this._repl))
      throw new Error('Unknown method: ' + message.method);
    // @ts-ignore
    return this._repl[message.method](message.params);
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
class REPL implements ShellHostInterface {
  private _shells = new Map<number, ShellHandler>();
  constructor(private _sendEvent: (eventName: string, data: any) => void) {}
  async obtainWebSocketId() {
    return ++lastWebSocketId;
  }
  async createJSShell(params: { cwd: string; socketId: number; }): Promise<{ nodePath: string; bootstrapPath: string; }> {
    this._shells.set(params.socketId, await makeGameShellHandler((eventName: string, data: any) => this._sendEvent('websocket', { socketId: params.socketId, message: { method: eventName, params: data } })));
    return {
      bootstrapPath: '',
      nodePath: '',
    }
  }
  async sendMessageToWebSocket({socketId, message}: { socketId: number; message: { method: string; params: any; id: number; }; }): Promise<void> {
    const shell = this._shells.get(socketId);
    try {
      const result = await shell(message.method as any, message.params);

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
  async reportTime(name) {
  }
  async loadItem({key}) {
    return localStorage.getItem('snail-repl-' + key);
  }
  async saveItem({key, value}) {
    localStorage.setItem('snail-repl-' + key, value);
    return 0;
  }

}
type ShellHandler = <T extends keyof ClientMethods>(method: T, params: Parameters<ClientMethods[T]>[0]) => Promise<ReturnType<ClientMethods[T]>>;
async function makeGameShellHandler(sendEvent: (eventName: string, data: any) => void): Promise<ShellHandler> {
  const url = new URL('../python_repl/python.worker.js', import.meta.url);
  
  const worker = new Worker(url.href, {type: 'module'});
  const inputBuffer = 'SharedArrayBuffer' in globalThis ? new SharedArrayBuffer(1024) : null;
  const isReady = await new Promise(x => worker.addEventListener('message', e => x(e.data), {once: true}));
  console.assert('ready' === isReady);
  worker.postMessage({method: 'setup_input_buffer', params: inputBuffer});
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
  
  type Handler = {
    [Key in keyof ClientMethods]?: (params: Parameters<ClientMethods[Key]>[0]) => Promise<ReturnType<ClientMethods[Key]>>;
  };
  
  const handler: Handler = {
    'Shell.enable': async (params) => {
    },
    'Shell.resize': async (params) => {
    },
    'Shell.input': async (params) => {
      const data = new TextEncoder().encode(params.data);
      new Uint8Array(inputBuffer).set(data, 4);
      new Int32Array(inputBuffer).set([data.length], 0);
      Atomics.notify(new Int32Array(inputBuffer), 0);
    },
  }
  return (method, params) => {
    if (method in handler)
      return handler[method](params);
    return workerRPC.send(method, params);
  }
}
