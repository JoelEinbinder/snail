const { parse } = require('./parser');
const { execute } = require('./runner');
const { tokenize } = require('./tokenizer');
const { Writable } = require('stream');
/**
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 */
function sh(strings, ...values) {
  if (strings.length !== 1)
    throw new Error('replacements unimplemented');

  const datas = [];
  let currentLine = '';
  const lines = [];
  /** @type {Set<() => void>} */
  const lineListeners = new Set();
  let done = false;
  const outStream = new Writable({
    async write(chunk, encoding, callback) {
        datas.push(chunk);
        const chunkLines = chunk.toString().split('\n');
        if (chunkLines.length === 1) {
          currentLine += chunkLines[0];
        } else {
          currentLine += chunkLines[0];
          addLine(currentLine);
          for (let i = 1; i < chunkLines.length - 1; i++)
            addLine(chunkLines[i]);
          currentLine = chunkLines[chunkLines.length - 1];
        }
        for (const listener of lineListeners)
          listener();
        callback();
    }
  });
  function addLine(line) {
    line = line.trimEnd();
    if (line)
      lines.push(line);
  }
  const {closePromise, stdin} = execute(parse(tokenize(strings[0])), outStream, process.stderr);
  stdin.end();
  closePromise.then(async () => {
    addLine(currentLine);
    done = true;
    for (const listener of lineListeners)
      listener();
  });

  return {
    /**
     * @param {(arg0: string[]) => void} resolve
     * @return {Promise<string[]>}
     */
    async then(resolve) {
      await closePromise;
      resolve(lines);
      return lines;
    },

    async * [Symbol.asyncIterator]() {
      let i = 0;
      while (true) {
        for (; i < lines.length; i++)
          yield lines[i];
        if (done)
          return;
        /** @type {() => void} */
        let after;
        await /** @type {Promise<void>} */ (new Promise(x => {
          lineListeners.add(x);
          after = () => lineListeners.delete(x);
        }));
        after();
      }
    }
  }
}

module.exports = {sh};