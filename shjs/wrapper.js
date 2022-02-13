const {execute, getChanges, setAlias} = require('./index');
if (process.argv[4]) {
  const aliases = JSON.parse(process.argv[4]);
  for (const alias of Object.keys(aliases))
    setAlias(alias, aliases[alias]);
}
const {stdin, closePromise, kill} = execute(process.argv[2]);
closePromise.then(c => {
  process.exitCode = c;
  if (!process.argv[3])
    return;
  const magicString = `\x33[JOELMAGIC${process.argv[3]}]\n`;
  const changes = getChanges();
  if (!changes)
    return;
  process.stdout.write(magicString);
  process.stdout.write(JSON.stringify(changes) + '\n');
});
