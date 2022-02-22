const {Parser, tokenizer, TokenType, tokTypes} = require('acorn');
const {tokenize} = require('./tokenizer');
const shTokenType = new TokenType('sh', {});
let gv = new Set();
const MyParser = Parser.extend(
  // @ts-ignore
  Parser => {
    return class extends /** @type {any} */ (Parser) {
      readToken(code) {
        const shExpression = this.shExpression();
        if (shExpression) {
          this.pos = this.start + shExpression.length;
          this.finishToken(shTokenType, shExpression);
          return;
        }
        super.readToken(code);
      }
      shExpression() {
        if (!this.canAwait)
          return null;
        const textBetween = this.input.slice(this.lastTokEnd, this.start);
        if (this.type.label !== ';' && this.type.label !== 'eof') {
          if (!textBetween.includes('\n'))
            return null;
          if (this.type.label.length === 1 && ',=+-:('.includes(this.type.label))
            return null;
        }
        const out = /[;\n]/.exec(this.input.slice(this.start)) || {index: this.input.length};
        const candidate = this.input.slice(this.start, this.start + out.index);
        if (candidate.startsWith('/')) {
          // TODO allow regex
          return candidate;
        }
        if (candidate.startsWith('.'))
          return candidate;
        const firstToken = Parser.tokenizer(candidate, this.options).getToken();
        if (firstToken.type.keyword || !firstToken.value)
          return null;
        if (firstToken.type === tokTypes.name) {
          // let is special cause its not a keyword
          if (firstToken.value === 'let' || firstToken.value === 'await')
            return null;
          if (gv.has(firstToken.value))
            return null;
          for (const stack of this.scopeStack) {
            if (stack.var.includes(firstToken.value))
              return null;
            if (stack.lexical.includes(firstToken.value))
              return null;
            if (stack.functions.includes(firstToken.value))
              return null;
          }
        }
        if (firstToken.type == tokTypes.num)
          return null;
        return candidate;
      }
      parseStatement(...args) {
        if (this.type !== shTokenType)
          return super.parseStatement(...args);
        const node = this.startNode();
        this.next();
        this.semicolon();
        return this.finishNode(node, "ShStatement");
      }
    }
  }
);

/**
 * @param {string} code
 * @param {string=} fnName
 * @param {Set<string>} globalVars
 */
function transformCode(code, fnName = 'sh', globalVars = new Set()) {
  const tokens = [];
  let before = gv;
  gv = globalVars;
  const node =  MyParser.parse(code, {ecmaVersion: 'latest', allowAwaitOutsideFunction: true, onToken: t => tokens.push(t)});
  gv = before;
  let newCode = code;
  for (const token of tokens.reverse()) {
    if (token.type !== shTokenType)
      continue;
    newCode = newCode.substring(0, token.start) + `await ${fnName}(${JSON.stringify(token.value)})` + newCode.substring(token.end);
  }
  return newCode;
}

module.exports = {transformCode};