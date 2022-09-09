async function resolveFileForIframe({filePath, headers, search}) {
  const searchParams = new URLSearchParams(search);
  if (searchParams.has('entry')) {
    return {
      statusCode: 200,
      data: toBuffer(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="${require.resolve('../iframe/iframe.css')}">
<script src="${require.resolve('../iframe/runtime.js')}" type="module"></script>
</head>
<body class=${JSON.stringify(searchParams.get('class'))} style=${JSON.stringify(searchParams.get('css'))}>
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
    cwd: filename
  });
  return result?.code || '';
}

module.exports = {resolveFileForIframe};