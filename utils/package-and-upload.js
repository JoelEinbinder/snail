const path = require('path');
const fs = require('fs');
const os = require('os');
const package = require('electron-packager');
const {spawn} = require('child_process');
const read = require('read');
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

/** @type {import('electron-packager').Options} */
const options = {
  dir: destination,
  name: 'snail',
  overwrite: true,
  appVersion: require('../package.json').version,
  out: dist,
};
(async () => {
  for (const arch of ['x64', 'arm64']) {
    const tarName = `snail-${'linux'}-${arch}-${require('../package.json').version}.tar.gz`;
    const outputFilePath = path.join(dist, tarName);
    await packageInDocker('linux', arch === 'x64' ? 'amd64' : arch, outputFilePath);
    console.warn('uploading', tarName);
    execSync(`scp ${outputFilePath} joel@joel.tools:joeltools/snail/`);
  }
  if (os.platform() === 'darwin') {
    execSync('npm install --no-package-lock', {
      stdio: 'inherit',
      cwd: destination,
    });
    const appleId = await read({prompt: 'Apple ID: ', default: 'joel.einbinder@gmail.com'});
    const teamId = await read({prompt: 'Team ID: ', default: 'KM96MU7G7A'});
    const appleIdPassword = await read({prompt: 'Apple ID Password: ', silent: true, replace: '*'});
    for (const arch of ['x64', 'arm64']) {
      package({
        ...options,
        appBundleId: 'tools.joel.snail',
        platform: 'darwin',
        arch,
        osxSign: {},
        osxNotarize: {
          tool: 'notarytool',
          appleId,
          appleIdPassword,
          teamId,
        },
        icon: path.join(__dirname, '..', 'icon', 'icon.icns'),
      }).then(folders => {
        uploadPackage(folders[0], {platform: 'darwin', arch});
      });
    }
  }
})();

function uploadPackage(folderPath, {platform, arch}) {
  const tarName = `snail-${platform}-${arch}-${require('../package.json').version}.tar.gz`;
  console.warn('uploading', tarName);
  const outputFilePath = path.join(dist, tarName);
  execSync(`tar czf ${outputFilePath} ${path.relative(dist, folderPath)}`, { cwd: dist });
  execSync(`scp ${outputFilePath} joel@joel.tools:joeltools/snail/`);
}

/**
 * @param {"linux"|"darwin"} platform
 * @param {"arm64"|"amd64"} arch
 * @param {string} outputFilePath
 */
async function packageInDocker(platform, arch, outputFilePath) {
  execSync(`docker build --tag=snail:package-${platform}-${arch} --platform=${platform}/${arch} --file=${path.join(__dirname, 'package.dockerfile')} .`, {
    cwd: path.join(__dirname, '.'),
    stdio: 'inherit',
  });
  const docker = spawn('docker', ['run', `--platform=${platform}/${arch}`, '--rm', `snail:package-${platform}-${arch}`], {
    stdio: 'pipe',
    cwd: path.join(__dirname, '.'),
  });
  docker.stdout.pipe(fs.createWriteStream(outputFilePath));
  docker.stderr.pipe(process.stderr);
  await new Promise(x => docker.on('exit', x));
}