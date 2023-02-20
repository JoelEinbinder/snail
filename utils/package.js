const path = require('path');
const fs = require('fs');
const os = require('os');
const package = require('electron-packager');
const toCopy = [
  'esout',
  'electron',
  'host',
  'slug/protocol',
  'slug/path_service',
  'slug/shell/spawnJSProcess.js',
  'slug/shell/download-slug-if-needed-and-run.sh',
];
const { execSync } = require('child_process');
execSync('npm run build', {
  stdio: 'inherit'
});
const destination = path.join(__dirname, 'electron-out');
fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
for (const dir of toCopy)
  fs.cpSync(path.join(__dirname, '..', dir), path.join(destination, dir), { recursive: true });
const json = require('../package.json');
delete json.devDependencies;
fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify(json, null, 2));
execSync('npm install --no-package-lock', {
  stdio: 'inherit',
  cwd: destination,
});
  
if (os.platform() === 'darwin') {
  package({
    dir: destination,
    name: 'Snail',
    platform: 'darwin',
    arch: 'arm64',
    overwrite: true,
    icon: path.join(__dirname, '..', 'icon', 'icon.icns'),
    appVersion: require('../package.json').version,
    osxSign: true, 
  });
} else {
  package({
    dir: destination,
    name: 'Snail',
    platform: 'linux',
    arch: 'arm64',
    overwrite: true,
    appVersion: require('../package.json').version,
  });
}


function makeRegex(str) {
  return new RegExp(`^/${str}$`);
}