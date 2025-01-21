const path = require('path');
const esbuild = require('esbuild');
const fs = require('fs');
const watch = process.argv.includes('--watch');
const repl = process.argv.includes('--repl');
const game = process.argv.includes('--game');
try {
  if (!watch)
    console.time('build');
  const target = repl ? 'repl' : game ? 'game' : 'desktop';
  const outDir = path.join(__dirname, '..', {
    'desktop': 'esout',
    'repl': 'repl_out',
    'game': 'game_out',
  }[target]);
  fs.rmSync(outDir, { recursive: true, force: true });
  const entryPoints = [
    path.join(__dirname, '..', 'src', 'index.ts'),
  ];
  /** @type {{[key: string]: string}} */
  const define = {};
  if (target === 'repl') {
    entryPoints.push(path.join(__dirname, '..', 'python_repl', 'python.worker.ts'));
    entryPoints.push(path.join(__dirname, '..', 'slug', 'shell', 'python', 'modules', 'web.ts'));
    define.IS_REPL = 'true';
  } else if (target === 'game') {
    entryPoints.push(path.join(__dirname, '..', 'game', 'game.worker.ts'));
    entryPoints.push(path.join(__dirname, '..', 'game', 'game-iframe.ts'));
    define.IS_GAME = 'true';
  }

  /** @type {import('esbuild').BuildOptions} */
  const options = {
    entryPoints,
    outdir: outDir,
    bundle: true,
    loader: {
      '.svg': 'dataurl',
      '.woff': 'file',
      '.ogg': 'file',
      '.mp3': 'file',
      '.html': 'file',
      '.png': 'file',
      '.py': 'text',
    },
    // TODO, splitting breaks on shjs
    splitting: false,
    format: 'esm',
    sourcemap: true,
    minify: true,
    treeShaking: true,
    define,
  };
  if (watch) {
    esbuild.build({
      ...options,
      watch: true,
    })
  } else {
    esbuild.buildSync(options);
    console.timeEnd('build');
  }
} catch(e) {
  console.error(e);
  process.exit(1);
}