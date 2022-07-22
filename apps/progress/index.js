
class ThrottleProgress {
  progress = null;
  lastFired = null;
  timer = null;
  fire() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    process.stdout.write(`\x1b\x1a\x4e${JSON.stringify(typeof this.progress === 'function' ? this.progress() : this.progress)}\x00`);
    this.lastFired = Date.now();
  }

  scheduleFire() {
    if (this.timer)
      return;
    this.timer = setTimeout(() => {
      this.fire();
    }, 16);
  }

  update(progress) {
    this.progress = progress;
    if (this.lastFired === null || Date.now() - this.lastFired > 16) {
      this.fire();
    } else {
      this.scheduleFire();
    }
  }
}
const throttle = new ThrottleProgress();
(async function() {
  let total = 100;
  console.time();
  for (let i = 0; i <= total; i++) {
    // await new Promise(x => setTimeout(x, 10));
    throttle.update(() => { return {
      progress: i / total,
      leftText: 'hi',
      rightText: (100 * i / total).toLocaleString(undefined, {
        unit: 'percent',
        style: 'unit',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    }});
    // throttle.update(i / total);
  }
  console.timeEnd();
})();
