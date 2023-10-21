const fs = require('fs');
const path = require('path');
const version = process.argv[2];
for (const package of ['../package.json', '../slug/package.json', '../slug/sdk/package.json']) {
  const packageJson = path.resolve(__dirname, package);
  const packageJsonContent = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  packageJsonContent.version = version;
  fs.writeFileSync(packageJson, JSON.stringify(packageJsonContent, null, 2));
}