const path = require('path');
const http = require('http');
/** @type {Map<string, import('esbuild').OutputFile>} */
const compiledFiles = new Map();

async function createDevServer(entryPoint = path.join(__dirname, '..', 'src', 'index.ts'), isREPL = false) {
  const server = http.createServer(async (req, res) => {
    try {
      const response = await getFileForURL(new URL('http://localhost' + req.url), entryPoint, isREPL);
      const headers = response.headers || {};
      headers['Content-Type'] = response.mimeType;
      res.writeHead(response.statusCode, headers);
      res.end(response.data);
    } catch(e) {
      console.error(e);
      res.writeHead(500);
      res.end();
    }
  });
  const url = await new Promise(resolve => {
    server.listen(undefined, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}/?entry`);
    });
  });
  return {
    url,
    close: () => server.close(),
  }
}

/**
 * @param {URL} url
 * @param {string} entryPoint
 * @param {boolean} isREPL
 */
async function getFileForURL(url, entryPoint, isREPL) {
  const {searchParams, pathname} = url;
  if (searchParams.has('entry')) {
    const esbuild = require('esbuild');
    const define = {};
    const entryPoints = [entryPoint];
    if (isREPL) {
      define.IS_REPL = 'true';
      entryPoints.push(path.join(__dirname, '..', 'python_repl', 'python.worker.ts'));
    }
    const server = await esbuild.build({
      bundle: true,
      write: false,
      allowOverwrite: true,
      entryPoints,
      loader: {
        '.woff': 'file',
        '.svg': 'file',
        '.py': 'text',
      },
      sourcemap: true,
      format: 'esm',
      // TODO find a way to do this without creating zombie processes
      // maybe esbuild is also just fast enough for a full rebuild every time
      // incremental: true,
      metafile: true,
      logLevel: 'error',
      outdir: path.dirname(entryPoint, '..', 'fake-electron-dev-out'),      
      absWorkingDir: '/',
      watch: false,
      treeShaking: true,
      define
    });
    for (const file of server.outputFiles)
      compiledFiles.set(file.path, file);
    const entryMeta = Object.entries(server.metafile.outputs).find(x => x[1].entryPoint && (path.resolve('/', x[1].entryPoint) === entryPoint));
    let cssText = '';
    if (entryMeta[1].cssBundle)
      cssText = `<link rel="stylesheet" href="${path.resolve('/', entryMeta[1].cssBundle)}">`;
    return {
      statusCode: 200,
      data: Buffer.from(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${cssText}
</head>
<body>
<script src="${path.resolve('/', entryMeta[0])}" type="module"></script>
</body>
</html>`),
      mimeType: 'text/html',
      headers: {
        'Cache-Control': 'no-cache',
      }
    };
  }

  const compiledFile = compiledFiles.get(pathname);
  if (compiledFile) {
    return {
      data: Buffer.from(compiledFile.contents),
      mimeType: require('mime-types').lookup(pathname) || undefined,
      statusCode: 200,
      headers: {
        'Cache-Control': 'max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      }
    };
  }

  return {
    statusCode: 404,
    data: '404',
    mimeType: 'text/plain',
  }

}

module.exports = { createDevServer };