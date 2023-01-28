import { startAyncWork } from "./async";

export class AntiFlicker {
  private count = 0;
  private _finishedWork?: () => void;
  constructor(
    private lock: () => void,
    private unlock: () => void,
  ) {}
  expectToDraw(maxDelay: number) {
    this.count++;
    if (this.count === 1) {
      this._finishedWork = startAyncWork('anti flicker');
      this.lock();
    }
    const unlock = () => {
      if (!timeout)
        return;
      clearTimeout(timeout);
      timeout = null;
      this.count--;
      if (this.count === 0) {
        this.unlock();
        this._finishedWork();
        delete this._finishedWork;
      }
    }
    let timeout = setTimeout(unlock, maxDelay);
    return unlock;
  }
}
