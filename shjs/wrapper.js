const {execute, getChanges} = require('./index');
const {stdin, closePromise, kill} = execute(process.argv[2]);
closePromise.then(c => {
  process.exitCode = c;
  const magic = process.argv[3];
  if (!magic)
    return;
  const changes = getChanges();
  if (!changes)
    return;
  process.stdout.write(magic + '\n');
  process.stdout.write(JSON.stringify(changes) + '\n');
});
