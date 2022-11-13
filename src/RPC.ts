export class RPC<ClientMethods extends {[key: string]: (arg0: any) => any}, ServerMethods> {
  private _id = 0;
  private _callbacks = new Map();
  private _listeners = new Map<keyof ServerMethods, Set<Function>>();
  private  _cwd: string;
  private _cwdHistory: string[] = [];
  public env: {[key: string]: string} = {};
  constructor(private _transport: Transport) {
    this._transport.listen(message => {
      if ('id' in message) {
        const callback = this._callbacks.get(message.id);
        callback.call(null, message);
        this._callbacks.delete(message.id);
      } else {
        this._emit(message.method as keyof ServerMethods, message.params);
      }
    });
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
  async send<Method extends keyof ClientMethods>(method: Method, params: Parameters<ClientMethods[Method]>[0]): Promise<ReturnType<ClientMethods[Method]>> {
    const id = ++this._id;
    const message = {id, method, params} as {id: number, method: string, params: any};
    const promise = new Promise<any>(x => this._callbacks.set(id, x));
    this._transport.send(message);
    const data = await promise;
    if (data.error)
      throw new Error(method + ': ' + data.error.message);
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
    const recentCwd = [];
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
    for (const [id, callback] of this._callbacks)
      callback({error: {message: 'Connection closed'}});
    this._callbacks.clear();
  }
}

interface Transport {
  send(message: {method: string, params: any, id: number}): void;
  listen(callback: (message: {method: string, params: any}|{id: number, result: any}) => void): void;
}
