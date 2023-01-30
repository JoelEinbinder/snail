#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const destination = path.join(__dirname, '..', 'runtime-out');
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });

const {execSync} = require('child_process');

const directoriesToCopy = [
  'host',
  'manpage_reader',
  'node_host',
  'protocol',
  'shell',
  'shjs',
  'thumbnail_generator',
  'icon_service',
  'include',

  'debugger',
  'apps',
  'datagrid',
];
const filesToCopy = [
  'package.json',
];

for (const file of filesToCopy)
  fs.copyFileSync(path.join(__dirname, '..', file), path.join(destination, file));

for (const directory of directoriesToCopy)
  fs.cpSync(path.join(__dirname, '..', directory), path.join(destination, directory), {
    recursive: true,
  });

// TODO don't install, just use package-lock and have the client install with their own nodejs
execSync("npm i --no-package-lock --omit=dev", {stdio: 'inherit', cwd: destination});
