export class UIThrottle<T> {
  private _timeout: number;
  private _pendingValue: T|Promise<T>;
  private _flushNumber = 0;
  constructor(
    private _value: T,
    private _onUpdate: (value: T) => void) {}

  get value() {
    return this._value;
  }

  update(value: T|Promise<T>) {
    this._clear();
    this._pendingValue = value;
    this._timeout = setTimeout(() => {
      this.flush();
    }, 100);
  }

  async flush() {
    const flushNumber = ++this._flushNumber;
    this._clear();
    const value = await this._pendingValue;
    if (flushNumber !== this._flushNumber)
      return;
    this._value = value;
    this._onUpdate(this._value);
  }

  _clear() {
    if (this._timeout)
      clearTimeout(this._timeout);
    delete this._timeout;
  }
}
