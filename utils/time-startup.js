const { performance } = require('node:perf_hooks');
const { spawn } = require('child_process');
const path = require('node:path');
const readline = require('readline/promises');
const child = spawn('node_modules/.bin/electron', [path.join(__dirname, '..'), '--test-headless'], {
  env: {
    ...process.env,
    SNAIL_TIME_STARTUP: '1',
  },
  cwd: path.join(__dirname, '..'),
  stdio: ['inherit', 'pipe', 'inherit'],
});
const start = performance.now();
const interface = readline.createInterface(child.stdout);
let last = start;
(async () => {
  for await (const line of interface) {
    if (line.startsWith('Time: ')) {
      const name = line.substring('Time: '.length);
      const now = performance.now();

      console.log(name, Math.round(now - last),  Math.round(now - start));
      last = now;
      if (name === 'create shell')
        child.kill();
    }
  }
})();
