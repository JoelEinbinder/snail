#!/usr/bin/env node
const { buildSlugIfNeeded } = require('./build-slug-if-needed');
const { execSync } = require('child_process');
const path = require('path');

(async () => {
  upload(await buildSlugIfNeeded('linux', 'arm64'));
  upload(await buildSlugIfNeeded('linux', 'amd64'));
  upload(await buildSlugIfNeeded('darwin', 'arm64'));
  function upload(filePath) {
    console.log('uploading', path.basename(filePath), 'to joel.tools');
    execSync(`scp ${filePath} joel@joel.tools:joeltools/slugs/`, { cwd: path.join(__dirname, '..')});
  }
})();

