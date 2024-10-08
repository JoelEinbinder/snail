const path = require('path');
const esbuild = require('esbuild');
const fs = require('fs');
try {
  console.time('build');
  const outDir = path.join(__dirname, '..', 'esout');
  fs.rmSync(outDir, { recursive: true, force: true });
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'src', 'index.ts')],
    outdir: outDir,
    bundle: true,
    loader: {
      '.svg': 'dataurl',
      '.woff': 'file',
    },
    // TODO, splitting breaks on shjs
    splitting: false,
    format: 'esm',
    sourcemap: true,
    minify: true,
    treeShaking: true,
  });
  console.timeEnd('build');
} catch(e) {
  console.error(e);
  process.exit(1);
}