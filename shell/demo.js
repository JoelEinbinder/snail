//@ts-check
const readline = require('readline');
const {Shell} = require('./shell');
/** @type {readline.Interface} */
let rl;

let history = [];
function startupRL() {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
    history
  });
  rl.on('line', (line) => {
    if (!line) {
      rl.prompt();
      return;
    }
    runCommand(line);
  });
  rl.on('history', (h) => {
    history = h;
  });
  rl.prompt();
}

function closeRL() {
  if (!rl) return;
  rl.close();
  rl = null;
}

const shell = new Shell();
shell.resize(process.stdout.columns, process.stdout.rows);
shell.on('data', data => {
  process.stdout.write(data);
});
shell.on('close', (code, signal) => {
  process.exit(code);
});
startupRL();

async function runCommand(command) {
  closeRL();
  const writer = data => {
    shell.sendRawInput(data);
  };
  process.stdin.on('data', writer);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  await shell.runCommand(command);
  process.stdin.off('data', writer);
  process.stdin.setRawMode(false);
  startupRL();
}
