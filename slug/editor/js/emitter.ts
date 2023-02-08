export class Emitter<Events = {}> {
  private _listeners = new Map<string|symbol|number, Set<Function>>();

  on<T extends keyof Events>(eventName: T, listener: (arg0: Events[T]) => void) {
    var set = this._listeners.get(eventName);
    if (!set) this._listeners.set(eventName, (set = new Set()));
    set.add(listener);
  }

  off<T extends keyof Events>(eventName: T, listener: (arg0: Events[T]) => void): boolean {
    var set = this._listeners.get(eventName);
    if (!set) return false;
    return set.delete(listener);
  }

  emit<T extends keyof Events>(eventName: T, data: Events[T]) {
    var set = this._listeners.get(eventName);
    if (!set) return;
    set.forEach(listener => listener(data));
  }

  once<T extends keyof Events>(eventName: T): Promise<Events[T]> {
    var fulfill;
    var promise = new Promise<Events[T]>(x => (fulfill = x));
    var listener = data => {
      this.off(eventName, listener);
      fulfill(data);
    };
    this.on(eventName, listener);
    return promise;
  }
}
