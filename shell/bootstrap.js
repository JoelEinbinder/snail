process.stdin.on('data', () => void 0);
require('inspector').open(undefined, undefined, false);

global.bootstrap = () => {
  const binding = global.magic_binding;
  delete global.magic_binding;
  delete global.bootstrap;
  console.log('doing bootstrap', {abc: 123});
};