#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { display, makeRPC } = require('../../sdk');;
display(path.join(__dirname, 'web.ts'));
const higlightCallbacks = new Map();
let lastHighlightId = 0;
const rpc = makeRPC({
  async save({file, content}) {
    await fs.promises.writeFile(file, content);
  },
  async close() {
    process.exit(0);
  },
  async highlight({content}) {
    if (!content || !doHighlight)
      return [];
    const id = ++lastHighlightId;
    doHighlight(content, id);
    const result = await new Promise(x => higlightCallbacks.set(id, x));
    higlightCallbacks.delete(id);
    return result;
  },
});
const pathArg = process.argv[2];
let absolutePath;
let relativePath;
if (pathArg) {
  absolutePath = path.resolve(pathArg);
  relativePath = path.relative(process.cwd(), absolutePath);
}
const highlightArg = process.argv[3];
let doHighlight;
if (highlightArg) {
  const child_process = require('child_process');
  const commandChild = child_process.spawn(highlightArg, {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const readline = require('readline');
  const rl = readline.createInterface({
    input: commandChild.stdout,
    output: commandChild.stdin,
    terminal: false,
  });
  rl.on('line', line => {
    const {id, tokens} = JSON.parse(line);
    higlightCallbacks.get(id)(tokens);
  });
  doHighlight = (content, id) => {
    commandChild.stdin.write(JSON.stringify({content, id}) + '\n');
  };
  process.on('beforeExit', () => {
    commandChild.kill();
  });
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
