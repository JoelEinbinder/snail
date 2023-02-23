export class JoelEvent<T = void> {
  private listeners = new Set<(arg: T) => void>();
  constructor(
    public current: T
  ) {}
  dispatch(arg: T) {
    this.current = arg;
    for (const listener of [...this.listeners]) {
      if (!this.listeners.has(listener))
        continue;
      listener(arg);
    }
  }
  on(listener: (arg: T) => void) {
    this.listeners.add(listener);
  }
  off(listener: (arg: T) => void) {
    this.listeners.delete(listener);
  }
  once(): Promise<T> {
    return new Promise<T>(x => {
      const cb = (arg: T) => {
        this.listeners.delete(cb);
        x(arg);
      };
      this.listeners.add(cb);
    });
  }
}
