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
const dist = path.join(__dirname, 'dist');
fs.rmSync(destination, { recursive: true, force: true });
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
fs.mkdirSync(dist, { recursive: true });
for (const dir of toCopy)
  fs.cpSync(path.join(__dirname, '..', dir), path.join(destination, dir), { recursive: true });
const json = require('../package.json');
delete json.devDependencies;
fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify(json, null, 2));
execSync('npm install --no-package-lock', {
  stdio: 'inherit',
  cwd: destination,
});
  
/** @type {import('electron-packager').Options} */
const options = {
  dir: destination,
  name: 'snail',
  overwrite: true,
  appVersion: require('../package.json').version,
  out: dist,
};
if (os.platform() === 'darwin') {
  for (const arch of ['x64', 'arm64']) {
    package({
      ...options,
      platform: 'darwin',
      arch,
      osxSign: true,
      icon: path.join(__dirname, '..', 'icon', 'icon.icns'),
    }).then(folders => {
      uploadPackage(folders[0], {platform: 'darwin', arch});
    });
  }
}

for (const arch of ['x64', 'arm64']) {
  package({
    ...options,
    platform: 'linux',
    arch,
  }).then(folders => {
    uploadPackage(folders[0], {platform: 'linux', arch});
  });;
}

function uploadPackage(folderPath, {platform, arch}) {
  const tarName = `snail-${platform}-${arch}-${require('../package.json').version}.tar.gz`;
  console.warn('uploading', tarName);
  const outputFilePath = path.join(dist, tarName);
  execSync(`tar czf ${outputFilePath} ${path.relative(dist, folderPath)}`, { cwd: dist });
  execSync(`scp ${outputFilePath} joel@joel.tools:joeltools/snail/`);
}
