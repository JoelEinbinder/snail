#!/usr/bin/env node
const path = require('path');
const {display, send, markdown} = require('../../sdk/');
const args = process.argv.slice(2);
const live = args.includes('-f');
const resolved = path.resolve(process.cwd(), args.find(a => !a.startsWith('-')));
const mimeType = require('mime-types').lookup(resolved);

function go() {
  send({
    filePath: resolved,
    mimeType,
  });
}

function shouldUseWebUI() {
  if (live)
    return true;
  if (mimeType.startsWith('application/json'))
    return true;
  if (mimeType.startsWith('image/'))
    return true;
  if (mimeType.startsWith('video/'))
    return true;
  if (mimeType.startsWith('audio/'))
    return true;
  if (resolved.endsWith('.excalidraw'))
    return true;
  return false;
}
if (shouldUseWebUI()) {
  display(path.join(__dirname, 'index.ts'));
  go();
  if (live) {
    const fs = require('fs');
    const watcher = fs.watch(resolved, (event, filename) => {
      go();
    });
  }
} else {
  if (mimeType.startsWith('text/markdown'))
    require('fs').createReadStream(resolved).on('data', chunk => {
      markdown(chunk.toString('utf-8'), path.dirname(resolved));
    });
  else if (mimeType.startsWith('text/'))
    require('fs').createReadStream(resolved).pipe(process.stdout);
  else
    console.error(`No viewer available for ${mimeType}`);
}