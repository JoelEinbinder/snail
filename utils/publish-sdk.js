#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

(async () => {
  execSync('npm publish', { cwd: path.join(__dirname, '..', 'slug', 'sdk'), stdio: 'inherit' });
})();

