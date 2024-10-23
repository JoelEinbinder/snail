const {tokenize} = require('./tokenizer');
const {parse} = require('./parser');
const {execute, getAndResetChanges, getResult, setAlias, getAliases, setAllAliases, setBashState, setBashFunctions} = require('./runner');

module.exports = {
  /**
   * @param {string} command
   * @param {import('stream').Writable} stdout
   * @param {import('stream').Writable} stderr
   * @param {import('stream').Readable|null=} stdin
   */
  execute(command, stdout = process.stdout, stderr = process.stderr, stdin = process.stdin, noSideEffects = false) {
    const {tokens} = tokenize(command);
    const ast = parse(tokens);
    return execute(ast, noSideEffects, stdout, stderr, stdin);
  },
  /**
   * @param {string} command
   */
  async getResult(command, noSideEffects = false) {
    let commandLeft = command;
    let result = { output: '', stderr: '', code: 0 };
    while (commandLeft.length) {
      const {tokens, raw} = tokenize(commandLeft);
      commandLeft = commandLeft.substring(raw.length + 1);
      const ast = parse(tokens);
      const tempResult = await getResult(ast, noSideEffects);
      result.output += tempResult.output;
      result.code = tempResult.code;
      result.stderr += tempResult.stderr;
      if (result.code != 0)
        break;
    }
    return result;
     
  },
  getAndResetChanges,
  setAlias,
  getAliases,
  setAllAliases,
  setBashState,
  setBashFunctions,
}