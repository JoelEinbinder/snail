const path = require('path');
const esbuild = require('esbuild');
const fs = require('fs');
const watch = process.argv.includes('--watch');
const repl = process.argv.includes('--repl');
try {
  if (!watch)
    console.time('build');
  const outDir = path.join(__dirname, '..', repl ? 'repl_out' : 'esout');
  fs.rmSync(outDir, { recursive: true, force: true });
  const entryPoints = [
    path.join(__dirname, '..', 'src', 'index.ts'),
  ];
  /** @type {{[key: string]: string}} */
  const define = {};
  if (repl) {
    entryPoints.push(path.join(__dirname, '..', 'python_repl', 'python.worker.ts'));
    define.IS_REPL = 'true';
  }

  /** @type {import('esbuild').BuildOptions} */
  const options = {
    entryPoints,
    outdir: outDir,
    bundle: true,
    loader: {
      '.svg': 'dataurl',
      '.woff': 'file',
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