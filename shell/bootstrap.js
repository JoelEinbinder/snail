process.stdin.on('data', () => void 0);
require('inspector').open(undefined, undefined, false);

global.bootstrap = () => {
  console.log('doing bootstrap', {abc: 123});
  delete global.bootstrap;
};