#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { makeRPC } = require('../../sdk');;
process.stdout.write(`\x1b\x1aL${JSON.stringify({
  entry:path.join(__dirname, 'index.ts'),
  browserView: true, 
})}\x00`);
const rpc = makeRPC({
  async save({file, content}) {
    await fs.promises.writeFile(file, content);
  },
  async close() {
    process.exit(0);
  }
});
const pathArg = process.argv[2];
let absolutePath;
let relativePath;
if (pathArg) {
  absolutePath = path.resolve(pathArg);
  relativePath = path.relative(process.cwd(), absolutePath);
}
let content = '';
let newFile = true;
try {
  if (pathArg) {
    content = fs.readFileSync(absolutePath, 'utf8');
    newFile = false;
  }
} catch {

}
rpc.notify('setContent', {
  content: content,
  absolutePath,
  relativePath,
  newFile, 
});
// TODO thread stdin in case it had some data in it before we went to web mode
// send a secret message and wait for it to come back.
// process.exit(0);
