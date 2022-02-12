const {execute, getChanges} = require('./index');
const {stdin, closePromise, kill} = execute(process.argv[2]);
closePromise.then(c => {
  process.exitCode = c;
  if (!process.argv[3])
    return;
  const magicString = `\x33[JOELMAGIC${process.argv[3]}]\n`;
  const changes = getChanges();
  if (!changes)
    return;
  process.stdout.write(magicString + '\n');
  process.stdout.write(JSON.stringify(changes) + '\n');
});
