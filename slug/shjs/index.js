const {tokenize} = require('./tokenizer');
const {parse} = require('./parser');
const {execute, getAndResetChanges, getResult, setAlias, getAliases, setAllAliases} = require('./runner');

module.exports = {
  /**
   * @param {string} command
   * @param {import('stream').Writable} stdout
   * @param {import('stream').Writable} stderr
   * @param {import('stream').Readable=} stdin
   */
  execute(command, stdout = process.stdout, stderr = process.stderr, stdin = process.stdin) {
    const {tokens} = tokenize(command);
    const ast = parse(tokens);
    return execute(ast, stdout, stderr, stdin);
  },
  getResult(command) {
    const {tokens} = tokenize(command);
    const ast = parse(tokens);
    return getResult(ast);
  },
  getAndResetChanges,
  setAlias,
  getAliases,
  setAllAliases,
}