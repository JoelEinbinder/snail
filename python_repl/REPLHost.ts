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
    return 'repl';
  }
}

type ShellHostInterface = {
  [Key in keyof ShellHost]?: (params: Parameters<ShellHost[Key]>[0]) => Promise<ReturnType<ShellHost[Key]>>;
};
let lastWebSocketId = 0;
class REPL implements ShellHostInterface {
  private _shells = new Map<number, ShellHandler>();
  private _history = [];
  constructor(private _sendEvent: (eventName: string, data: any) => void) {
    const storedHistory = localStorage.getItem('snail-repl-history');
    if (storedHistory)
      this._history = JSON.parse(storedHistory);
  }
  async obtainWebSocketId() {
    return ++lastWebSocketId;
  }
  async createJSShell(params: { cwd: string; socketId: number; }) {
    this._shells.set(params.socketId, await makeReplShellHandler((eventName: string, data: any) => this._sendEvent('websocket', { socketId: params.socketId, message: { method: eventName, params: data } })));
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
  async addHistory(item: { command: string; start: number; language: 'shjs' | 'python' | 'javascript' | 'bash'; }) {
    this._history.push(item);
    this._history = this._history.slice(-1000);
    localStorage.setItem('snail-repl-history', JSON.stringify(this._history));
    return this._history.length - 1;
  }
  async updateHistory({id, col, value}: { col: string; id: number; value: any; }) {
    this._history[id][col] = value;
    localStorage.setItem('snail-repl-history', JSON.stringify(this._history));
    return 1;
  }
  async queryDatabase({sql, params}: { sql: string; params: any[]; }): Promise<any[]> {
    console.warn(sql, params);
    return [];
  }
  async searchHistory({start, direction, prefix, current}: { current: string; prefix: string; start: number; firstCommandId: number; direction: number; }): Promise<'end' | 'current' | { command: string; historyIndex: number; language: 'shjs' | 'python' | 'javascript' | 'bash'; }> {
    let startIndex = start + direction - 1;
    if (direction === -1)
      startIndex = Math.min(startIndex, this._history.length - 1);
    for (let i = startIndex; i < this._history.length && i >= 0; i += direction) {
      const {command, language} = this._history[i];
      if (current === command || !command.startsWith(prefix))
        continue;
      return {
        command,
        language,
        historyIndex: i + 1,
      }
    }
    if (direction === -1)
      return 'current';
    return 'end';  
  }
  async destroyWebsocket(params: { socketId: number; }): Promise<void> {
    this._shells.delete(params.socketId);
  }
  async close() { }
  async beep() { }
  async urlForIFrame(params: {shellIds: number[], filePath: string}) {
    const url = new URL('./python_repl/matplotlib-iframe.html', self.location.href);
    return url.href;
  };
  async reportTime(name) {
  }
  async loadItem({key}) {
    const str = localStorage.getItem('snail-repl-' + key);
    if (!str)
      return undefined;
    try {
      return JSON.parse(str);
    } catch {
      return undefined;
    }
  }
  async saveItem({key, value}) {
    localStorage.setItem('snail-repl-' + key, JSON.stringify(value));
    return 0;
  }

}
type ShellHandler = <T extends keyof ClientMethods>(method: T, params: Parameters<ClientMethods[T]>[0]) => Promise<ReturnType<ClientMethods[T]>>;
async function makeReplShellHandler(sendEvent: (eventName: string, data: any) => void): Promise<ShellHandler> {
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
