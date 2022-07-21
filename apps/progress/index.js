(async function() {
  let total = 1000;
  for (let i = 0; i <= total; i++) {
    await new Promise(x => setTimeout(x, 10));
    updateProgress({
      progress: i / total,
      // leftText: 'hi',
      rightText: (100 * i / total).toLocaleString(undefined, {
        unit: 'percent',
        style: 'unit',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    });
  }
})();

function updateProgress(progress) {
  process.stdout.write(`\x1b\x1a\x4e${JSON.stringify(progress)}\x00`);
}