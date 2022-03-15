import {Protocol} from './protocol';
export class JSConnection {
  private _id = 0;
  private _callbacks = new Map();
  private _listeners = new Map<string, Set<Function>>();
  constructor(private _transport: Transport) {
    this._transport.listen(data => {
      const message = JSON.parse(data);
      if ('id' in message) {
        const callback = this._callbacks.get(message.id);
        callback.call(null, message);
        this._callbacks.delete(message.id);
      } else {
        this._emit(message.method, message.params);
      }
    });
  }
  private _emit(method: string, params: any) {
    const listeners = this._listeners.get(method);
    if (listeners)
      for (const listener of [...listeners])
        listener(params);
  }
  on<Method extends keyof Protocol.Events>(method: Method, listener: (params: Protocol.Events[Method]) => void) {
    let listeners = this._listeners.get(method);
    if (!listeners)
      this._listeners.set(method, listeners = new Set());
    listeners.add(listener);
  }
  off<Method extends keyof Protocol.Events>(method: Method, listener: (params: Protocol.Events[Method]) => void) {
    const listeners = this._listeners.get(method);
    if (listeners)
      listeners.delete(listener);
  }
  async send<Method extends keyof Protocol.CommandParameters>(method: Method, params: Protocol.CommandParameters[Method]): Promise<Protocol.CommandReturnValues[Method]> {
    const id = this._id++;
    const message = {id, method, params};
    const promise = new Promise<any>(x => this._callbacks.set(id, x));
    await this._transport.ready;
    this._transport.send(JSON.stringify(message));
    const data = await promise;
    if (data.error)
      throw new Error(method + ': ' + data.error.message);
    return data.result;
  }
}

interface Transport {
  send(message: string): void;
  ready: Promise<void>;
  listen(callback: (message: string) => void): void;
}
