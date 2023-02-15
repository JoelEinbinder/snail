const os = require('os');
const path = require('path');
const fs = require('fs');
const glob = require('fast-glob')
const {execSync, spawn} = require('child_process');
const slugDir = path.join(__dirname, '..', 'slug');

async function maxMTime(sourceFiles) {
  const stats = await Promise.all(sourceFiles.map(file => fs.promises.stat(path.join(slugDir, file))));
  return Math.max(...stats.map(s => s.mtime));
}
/**
 * @param {"linux"|"darwin"} platform
 * @param {"arm64"|"amd64"} arch
 */
async function buildSlugIfNeeded(platform, arch) {
  const ignore = [
    './editor/test/**/*',
    './editor/text/**/*',
    './shjs/test-assets/**/*',
    './shjs/test.js',
    'tsconfig.json',
    '.gitignore',
    '**/build/**/*',
    '**/node_modules/**/*',
  ];
  const sourceFiles = glob.sync('**/*', {
    cwd: slugDir,
    ignore,
  });
  const destination = path.join(__dirname, '..', 'slug-out');
  const destFiles = glob.sync('**/*', {
    cwd: destination,
    ignore,
  });
  const unamePlatform = {
    'linux': 'Linux',
    'darwin': 'Darwin',
  }[platform];
  const unameArch = {
    'arm64': unamePlatform === 'Linux' ? 'aarch64' : 'arm64',
    'amd64': 'x86_64',
  }[arch];
  const tarName = `slug-${require('../package.json').version}-${unamePlatform}-${unameArch}.tar.gz`;
  const outputFilePath = path.join(__dirname, 'built-slugs', tarName);

  if (fs.existsSync(outputFilePath) && destFiles.length === sourceFiles.length && await maxMTime(sourceFiles) < fs.statSync(outputFilePath).mtimeMs)
    return outputFilePath;
  await fs.promises.mkdir(path.join(__dirname, 'built-slugs'), { recursive: true });
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  await Promise.all(sourceFiles.map(file => fs.promises.cp(path.join(__dirname, '..', 'slug', file), path.join(destination, file))));

  if (platform === 'linux') {
    await buildSlugInDocker(platform, arch, outputFilePath);
  } else if (platform === 'darwin') {
    await buildSlugLocally(outputFilePath);
  } else {
    throw new Error('Unknown platform: ' + platform);
  }
  return outputFilePath;
}

/**
 * @param {"linux"|"darwin"} platform
 * @param {"arm64"|"amd64"} arch
 * @param {string} outputFilePath
 */
async function buildSlugInDocker(platform, arch, outputFilePath) {
  execSync(`docker build --tag=snail:bundle-${platform}-${arch} --platform=${platform}/${arch} --file=${path.join(__dirname, 'bundle.dockerfile')} .`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  const docker = spawn('docker', ['run', `--platform=${platform}/${arch}`, '--rm', `snail:bundle-${platform}-${arch}`], {
    stdio: 'pipe',
    cwd: path.join(__dirname, '..'),
  });
  docker.stdout.pipe(fs.createWriteStream(outputFilePath));
  await new Promise(x => docker.on('exit', x));
}

/**
 * @param {string} outputFilePath
 */
async function buildSlugLocally(outputFilePath) {
  if (os.platform() != 'darwin' || os.arch() != 'arm64')
    throw new Error('expected to run this on apple silicon');
  if (!fs.existsSync(path.join(__dirname, '..', 'node_18.14.0'))) {
    execSync('curl --no-progress-meter -o node.tar.gz https://nodejs.org/dist/v18.14.0/node-v18.14.0-darwin-arm64.tar.gz', { cwd: path.join(__dirname, '..')});
    execSync('mkdir node_18.14.0 && tar xf node.tar.gz -C node_18.14.0 --strip-components 1', { cwd: path.join(__dirname, '..')});
    execSync('rm node.tar.gz', { cwd: path.join(__dirname, '..')});
  }
  execSync(`PATH=${path.join(__dirname, '..', 'node_18.14.0', 'bin')}:$PATH npm i --no-package-lock --omit=dev`, {stdio: 'inherit', cwd: path.join(__dirname, '..', 'slug-out')});
  execSync(`tar czf ${outputFilePath} -C ./slug-out .`, { cwd: path.join(__dirname, '..')});
}
module.exports = { buildSlugIfNeeded }