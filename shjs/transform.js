const {Parser, tokenizer, TokenType, tokTypes} = require('acorn');
const {tokenize} = require('./tokenizer');
const shTokenType = new TokenType('sh', {});
let gv = new Set();
let onNode;
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
          if (!textBetween.includes('\n') && (this.type !== tokTypes.parenR || this.input[this.start] === '.'))
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
        if (!firstToken.value)
          return null;
        if (firstToken.type.keyword) {
          if (firstToken.type !== tokTypes._export)
            return null;
        }
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
      parseStatement(context, topLevel, exports) {
        if (this.type !== shTokenType)
          return super.parseStatement(context, topLevel, exports);
        const node = this.startNode();
        this.next();
        this.semicolon();
        return this.finishNode(node, "ShStatement");
      }
      finishNode(...args) {
        const node = super.finishNode(...args);
        if (onNode)
          onNode(node);
        return node;
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
  /** @type {import('acorn').Token[]} */
  const tokens = [];
  let before = gv;
  gv = globalVars;
  try {
    MyParser.parse(code, {ecmaVersion: 'latest', allowAwaitOutsideFunction: true, onToken: t => tokens.push(t)});
  } catch(error) {
  }
  gv = before;
  let newCode = code;
  for (const token of tokens.reverse()) {
    if (token.type !== shTokenType)
      continue;
    newCode = newCode.substring(0, token.start) + `await ${fnName}(${JSON.stringify(token.value)})` + newCode.substring(token.end);
  }
  return newCode;
}

function getAutocompletePrefix(code, globalVars = new Set()) {
  const magicString = 'JOEL_AUTOCOMPLETE_MAGIC';
  /** @type {import('acorn').Token[]} */
  const tokens = [];
  let before = gv;
  gv = globalVars;
  /** @type {null|string|{shPrefix: string}} */
  let found = null;
  try {
    const fullCode = code + magicString;
    onNode = node => {
      if (node.type === 'MemberExpression' && node.property.type === 'Identifier' && node.property.name === magicString) {
        found = fullCode.slice(node.object.start, node.object.end);
      } else if (node.type === 'ShStatement') {
        const shText = fullCode.slice(node.start, node.end);
        if (shText.trim() === magicString)
          found = '';
        else if (shText.includes(magicString))
          found = {shPrefix: shText.split(magicString)[0]};
      }
    };
    MyParser.parse(fullCode, {ecmaVersion: 'latest', allowAwaitOutsideFunction: true, onToken: t => tokens.push(t) });
  } catch(error) {
  }
  gv = before;
  return found;
}


module.exports = {transformCode, getAutocompletePrefix};