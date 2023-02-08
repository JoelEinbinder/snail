import { startAyncWork } from "./async";

export class AntiFlicker<T = unknown> {
  private count = 0;
  private _finishedWork?: () => void;
  private _lockReturnValue?: T;
  constructor(
    private lock: () => T,
    private unlock: (lockReturnValue: T) => void,
  ) {}
  expectToDraw(maxDelay: number) {
    this.count++;
    if (this.count === 1) {
      this._finishedWork = startAyncWork('anti flicker');
      this._lockReturnValue = this.lock();
    }
    const unlock = () => {
      if (!timeout)
        return;
      clearTimeout(timeout);
      timeout = null;
      this.count--;
      if (this.count === 0) {
        this.unlock(this._lockReturnValue!);
        this._finishedWork();
        delete this._finishedWork;
        delete this._lockReturnValue;
      }
    }
    let timeout = setTimeout(unlock, maxDelay);
    return unlock;
  }
}
