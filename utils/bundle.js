#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const destination = path.resolve(process.cwd(), process.argv[2]);
rimraf.sync(destination);
fs.mkdirSync(destination, { recursive: true });

const {execSync} = require('child_process');
execSync('npm run build', { stdio: 'inherit' });

const directoriesToCopy = [
  'dist',
  'apps',
  'host',
  'iframe',
  'manpage_reader',
  'node_host',
  'protocol',
  'shell',
  'shjs',
  'thumbnail_generator'
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

execSync("npm i --no-package-lock --omit=dev", {stdio: 'inherit', cwd: destination});
