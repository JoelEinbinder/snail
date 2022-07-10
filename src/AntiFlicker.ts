export class AntiFlicker {
  private count = 0;
  constructor(
    private lock: () => void,
    private unlock: () => void,
  ) {}
  expectToDraw(maxDelay: number) {
    this.count++;
    if (this.count === 1)
      this.lock();
    const unlock = () => {
      if (!timeout)
        return;
      clearTimeout(timeout);
      timeout = null;
      this.count--;
      if (this.count === 0)
        this.unlock();
    }
    let timeout = setTimeout(unlock, maxDelay);
    return unlock;
  }
}
