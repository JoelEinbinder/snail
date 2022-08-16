//@ts-check
const {PipeTransport} = require('../protocol/pipeTransport');
const {RPC} = require('../protocol/rpc');
const transport = new PipeTransport(process.stdout, process.stdin);
process.stdin.on('close', () => process.exit());

const rpc = RPC(transport, {
  /** @param {string} code */
  async evaluate(code) {
    const {getResult} = require('../shjs/index');
    const {output} = await getResult(code);
    return output;
  },
  /** @param {string} dir */
  async chdir(dir) {
    process.chdir(dir || require('os').homedir());
  },
  async env(env) {
    for (const [key, value] of Object.entries(env))
      process.env[key] = value;
  },
  async aliases(aliases) {
    for (const [key, value] of Object.entries(aliases)) {
      require('../shjs/index').setAlias(key, value);
    }
  },
  async resolveFileForIframe({filePath, headers, search}) {
    const searchParams = new URLSearchParams(search);
    if (searchParams.has('entry')) {
      return {
        statusCode: 200,
        data: toBuffer(`<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="${require.resolve('../iframe/iframe.css')}">
  <script src="${require.resolve('../iframe/runtime.js')}" type="module"></script>
</head>
<body>
<script src="${filePath}" type="module"></script>
</body>
</html>`),
        mimeType: 'text/html',
        headers: {
          'Cache-Control': 'max-age=31536000',
        }
      };
    }
    const fs = require('fs');
    const responseHeaders = {
      'cache-control': 'no-cache',
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
        data: require('../thumbnail_generator/').generateThumbnail(filePath),
        mimeType: 'image/png',
        statusCode: 200,
        headers: responseHeaders,
      }
    }
    if (headers.accept && headers.accept === '*/*') {
      const resolved = resolveScript(filePath);
      if (!resolved) {
        return {
          statusCode: 404,
          data: '404',
          mimeType: 'text/plain',
        }
      }
      responseHeaders.etag = fs.lstatSync(resolved, {}).ctimeMs.toString();
      if (headers['if-none-match'] === responseHeaders.etag) {
        return {
          statusCode: 304,
          mimeType: 'application/javascript',
          headers: responseHeaders,
        }
      }
      if (resolved.endsWith('.css')) {
        return {
          statusCode: 200,
          mimeType: 'application/javascript',
          data: toBuffer(`const style = document.createElement('style');
  style.innerHTML = ${JSON.stringify(fs.readFileSync(resolved, 'utf8'))};
  document.head.append(style);`),
        }
      }
      return {
        statusCode: 200,
        mimeType: 'application/javascript',
        data: resolved.endsWith('.ts') ? toBuffer(transformTs(resolved)) : fs.readFileSync(resolved).toString('base64'),
        headers: responseHeaders,
      }
    }

    return {
      data: fs.readFileSync(filePath).toString('base64'),
      statusCode: 200,
      mimeType: require('mime-types').lookup(filePath) || undefined,
      headers: responseHeaders,
    };
  }
});

function resolveScript(filePath) {
  const old = require.extensions;
  if (!require.extensions['.ts'])
    require.extensions['.ts'] = require.extensions['.js'];
  try {
    return require.resolve(filePath);
  } catch {
    return null;
  }
}

function toBuffer(text) {
  return Buffer.from(new TextEncoder().encode(text)).toString('base64');
}

function transformTs(filename) {
  const babel = require('@babel/core');
  const result = babel.transformFileSync(filename, {
    presets: [
      // ['@babel/preset-env', { targets: {node: '10.17.0'} }],
      [require.resolve('@babel/preset-typescript'), { onlyRemoveTypeImports: false }],
    ],
    // plugins: [['@babel/plugin-proposal-class-properties', {loose: true}]],
    sourceMaps: false,
    // cwd: __dirname
  });
  return result?.code || '';
}