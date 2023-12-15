#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const { display, makeRPC } = require('../../sdk');
const { parseArgs } = require('util');
const options = /** @type {import('util').ParseArgsConfig} */ ({
  highlight: {
    type: 'string',
    short: 'h',
    default: '',
  },
  'test-highlight': {
    type: 'boolean',
    default: false,
  },
  help: {
    type: 'boolean',
    default: false,
  },
});
const parsedArgs = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  strict: true,
  options,
});
if (parsedArgs.values.help) {
  for (const [name, option] of Object.entries(options)) {
    if (option.type !== 'boolean')
      console.log(`--${name} ${option.type}${option.short ? `, -${option.short}` : ''}`);
    else
      console.log(`--${name}${option.short ? `, -${option.short}` : ''}`);
  }
  process.exit(0);
}
const pathArg = parsedArgs.positionals[0];
let absolutePath;
let relativePath;
if (pathArg) {
  absolutePath = path.resolve(pathArg);
  relativePath = path.relative(process.cwd(), absolutePath);
}
const higlightCallbacks = new Map();

if (parsedArgs.values['test-highlight']) {
  console.log('test-highlight');
  const doHighlight = setupHighlight();
  if (!doHighlight)
    throw new Error('No highlighter configured');
  const content = fs.readFileSync(absolutePath, 'utf8');
  const id = 1;
  doHighlight(content, 1);
  const promise = new Promise((resolve, reject) => higlightCallbacks.set(id, {resolve, reject}));
  promise.then(result => {
    console.log(result);
    process.exit(0);
  }, error => {
    console.error(error);
    process.exit(1);
  });
} else {
  display(path.join(__dirname, 'web.ts'));
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
      const result = await new Promise((resolve, reject) => higlightCallbacks.set(id, {resolve, reject}));
      higlightCallbacks.delete(id);
      return result;
    },
  });
  const doHighlight = setupHighlight();

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
}

function setupHighlight() {
  const highlightArg = parsedArgs.values.highlight;
  if (!highlightArg)
    return null;
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
    const {id, tokens, error} = JSON.parse(line);
    if (error)
      higlightCallbacks.get(id).reject(new Error(error));
    else
      higlightCallbacks.get(id).resolve(tokens);
  });
  process.on('beforeExit', () => {
    commandChild.kill();
  });
  return (content, id) => {
    commandChild.stdin.write(JSON.stringify({content, id}) + '\n');
  };
}