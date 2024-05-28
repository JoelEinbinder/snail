export class RPC<ClientMethods extends {[key: string]: (arg0: any) => any}, ServerMethods> {
  private _id = 0;
  private _callbacks = new Map();
  private _listeners = new Map<keyof ServerMethods, Set<Function>>();
  private _cwd: string;
  private _cwdHistory: string[] = [];
  private _closed = false;
  public env: {[key: string]: string} = {};
  constructor(
    private _transport: Transport,
    private _abortFn?: (id: number) => void,
  ) {
    this._transport.onmessage = message => {
      if ('id' in message) {
        const callback = this._callbacks.get(message.id);
        callback.call(null, message);
        this._callbacks.delete(message.id);
      } else {
        this._emit(message.method as keyof ServerMethods, message.params);
      }
    };
  }
  private _emit(method: keyof ServerMethods, params: any) {
    const listeners = this._listeners.get(method);
    if (listeners)
      for (const listener of [...listeners])
        listener(params);
  }
  on<Method extends keyof ServerMethods>(method: Method, listener: (params: ServerMethods[Method]) => void) {
    let listeners = this._listeners.get(method);
    if (!listeners)
      this._listeners.set(method, listeners = new Set());
    listeners.add(listener);
  }
  off<Method extends keyof ServerMethods>(method: Method, listener: (params: ServerMethods[Method]) => void) {
    const listeners = this._listeners.get(method);
    if (listeners)
      listeners.delete(listener);
  }
  async send<Method extends keyof ClientMethods>(
    method: Method,
    params: Parameters<ClientMethods[Method]>[0],
    abortSignal?: AbortSignal,
  ): Promise<ReturnType<ClientMethods[Method]>> {
    if (abortSignal?.aborted)
      return;
    if (this._closed)
      throw new Error(String(method) + ': ' + 'Connection closed');
    const abort = () => this._abortFn?.(id);
    const id = ++this._id;
    const message = {id, method, params} as {id: number, method: string, params: any};
    const promise = new Promise<any>(x => this._callbacks.set(id, x));
    abortSignal?.addEventListener('abort', abort);
    this._transport.send(message);
    const data = await promise;
    abortSignal?.removeEventListener('abort', abort);
    if (data.error)
      throw new Error(String(method) + ': ' + data.error.message);
    return data.result;
  }

  get cwd(): string {
    return this._cwd;
  }

  set cwd(value: string) {
    this._cwd = value;
    this._cwdHistory.push(value);
  }

  getRecentCwd() {
    const seen = new Set<string>();
    const recentCwd: string[] = [];
    for (const cwd of this._cwdHistory.reverse()) {
      if (recentCwd.length >= 6)
        break;
      if (seen.has(cwd))
        continue;
      seen.add(cwd);
      recentCwd.push(cwd);
    }
    return recentCwd;
  }

  didClose() {
    if (this._closed)
      return;
    this._closed = true;
    for (const [id, callback] of this._callbacks)
      callback({error: {message: 'Connection closed'}});
    this._callbacks.clear();
  }
}

export interface Transport {
  send(message: {method: string, params: any, id: number}): void;
  onmessage?: (message: {method: string, params: any}|{id: number, result: any}) => void;
}
