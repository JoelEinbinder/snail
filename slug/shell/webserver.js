const path = require('path');
/** @type {Map<string, import('esbuild').OutputFile>} */
const compiledFiles = new Map();
async function resolveFileForIframe({filePath, headers, search}) {
  const searchParams = new URLSearchParams(search);
  if (searchParams.has('entry')) {
    try {
      const resolved = path.resolve('/', filePath);
      const esbuild = require('esbuild');
      const server = await esbuild.build({
        bundle: true,
        write: false,
        entryPoints: [resolved],
        loader: {
          '.woff': 'file',
          '.svg': 'file',
        },
        assetNames: '[name]-[hash]',
        chunkNames: '[name]-[hash]',
        entryNames: '[name]-[hash]',
        sourcemap: true,
        format: 'esm',
        // TODO find a way to do this without creating zombie processes
        // maybe esbuild is also just fast enough for a full rebuild every time
        // incremental: true,
        metafile: true,
        logLevel: 'error',
        outdir: path.dirname(resolved),
        absWorkingDir: '/',
        watch: false,
      });
      for (const file of server.outputFiles)
        compiledFiles.set(file.path, file);
      const entryMeta = Object.entries(server.metafile.outputs).find(x => x[1].entryPoint && (path.resolve('/', x[1].entryPoint) === resolved));
      let cssText = '';
      if (entryMeta[1].cssBundle)
        cssText = `<link rel="stylesheet" href="${path.resolve('/', entryMeta[1].cssBundle)}">`;
      return {
        statusCode: 200,
        data: toBuffer(`<!DOCTYPE html>
  <html>
  <head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="${require.resolve('../iframe/iframe.css')}">
  <script src="${require.resolve('../iframe/iframe.js')}" type="module"></script>
  ${cssText}
  </head>
  <body class=${JSON.stringify(searchParams.get('class'))} style=${JSON.stringify(searchParams.get('css'))}>
  <script src="${path.resolve('/', entryMeta[0])}" type="module"></script>
  </body>
  </html>`),
        mimeType: 'text/html',
        headers: {
          'Cache-Control': 'no-cache',
        }
      };
    } catch (error) {
      return {
        statusCode: 500,
        data: toBuffer(`<!DOCTYPE html>
  <html>
  <head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="${require.resolve('../iframe/iframe.css')}">
  <script src="${require.resolve('../iframe/iframe.js')}" type="module"></script>
  </head>
  <body class=${JSON.stringify(searchParams.get('class'))} style=${JSON.stringify(searchParams.get('css'))}>
  <script>window.snail_error = ${JSON.stringify(Buffer.from(String(error)).toString('base64'))}</script>
  <script src="${require.resolve('../iframe/error.js')}" type="module"></script>
  </body>
  </html>`),
        mimeType: 'text/html',
        headers: {
          'Cache-Control': 'no-cache',
        }
      };
    }
  }
  const fs = require('fs');
  const responseHeaders = {
    'cache-control': searchParams.has('cache') ? 'max-age=31536000' : 'no-cache',
  };
  if (searchParams.has('thumbnail')) {
    responseHeaders.etag = fs.lstatSync(filePath, {}).ctimeMs.toString();
    if (headers['if-none-match'] === responseHeaders.etag) {
      return {
        statusCode: 304,
        mimeType: 'image/png',
        headers: responseHeaders,
      }
    }
    return {
      data: require('../thumbnail_generator/').generateThumbnail(filePath, parseInt(searchParams.get('size') || '16', 10)),
      mimeType: 'image/png',
      statusCode: 200,
      headers: responseHeaders,
    }
  }

  const compiledFile = compiledFiles.get(filePath);
  if (compiledFile) {
    return {
      data: Buffer.from(compiledFile.contents).toString('base64'),
      mimeType: require('mime-types').lookup(filePath) || undefined,
      statusCode: 200,
      headers: {
        'Cache-Control': 'max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      }
    };
  }

  try {
    return {
      data: fs.readFileSync(filePath).toString('base64'),
      statusCode: 200,
      mimeType: require('mime-types').lookup(filePath) || undefined,
      headers: responseHeaders,
    };
  } catch {
    return {
      statusCode: 404,
      data: '404',
      mimeType: 'text/plain',
    }
  }
}

function toBuffer(text) {
  return Buffer.from(new TextEncoder().encode(text)).toString('base64');
}

module.exports = {resolveFileForIframe};