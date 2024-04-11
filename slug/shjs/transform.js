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
          this.pos = this.start + shExpression.raw.length;
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
          if (!textBetween.includes('\n')) {
            if (this.type !== tokTypes.parenR)
              return null;
            if (this.input[this.start] === '.')
              return null;
          } 
          if (this.context[this.context.length - 1].token === '(')
            return null;
          if (this.type.label.length === 1 && ',=+-:('.includes(this.type.label))
            return null;
        }
        const {tokens, raw} = tokenize(this.input.slice(this.start), code => {
          return code.substring(0, code.indexOf('}'));
        });
        const candidate = raw;
        if (candidate.startsWith('/')) {
          // TODO allow regex
          return makeReturnValue();
        }
        if (candidate.startsWith('.'))
          return makeReturnValue();
        if (candidate.startsWith('#'))
          return makeReturnValue();
        const firstToken = Parser.tokenizer(candidate, this.options).getToken();
        if (!firstToken.value)
          return null;
        if (firstToken.type.keyword) {
          if (firstToken.type !== tokTypes._export)
            return null;
        }
        if (firstToken.type === tokTypes.name) {
          // let/await/async are special cause they are not keywords
          if (firstToken.value === 'let' || firstToken.value === 'await' || firstToken.value === 'async')
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
        return makeReturnValue();
        function makeReturnValue() {
          const hasTemplate = tokens.some(t => t.type === 'template');
          const transformed = hasTemplate ? ('`' + tokens.map(t => {
            if (t.type === 'template') {
              return t.raw;
            }
            const stringified = JSON.stringify(t.raw);
            return stringified.substring(1, stringified.length - 1).replace(/`/g, '\\`');
          }).join('') + '`') : JSON.stringify(tokens.map(t => t.raw).join(''));
          return {
            transformed,
            raw,
            tokens,
          }
        }
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
    if (token.value.tokens.length === 1 && token.value.tokens[0].type === 'comment') {
      newCode = newCode.substring(0, token.start) + `//${token.value.tokens[0].value}` + newCode.substring(token.end);
    } else {
      newCode = newCode.substring(0, token.start) + `await ${fnName}(${token.value.transformed})` + newCode.substring(token.end);
    }
  }
  return newCode;
}

function getAutocompletePrefix(code, globalVars = new Set()) {
  const magicString = 'JOEL_AUTOCOMPLETE_MAGIC';
  /** @type {import('acorn').Token[]} */
  const tokens = [];
  let before = gv;
  gv = globalVars;
  /** @type {null|{start: number, end: number, isSh: boolean}} */
  let found = null;
  try {
    const fullCode = code + magicString;
    onNode = node => {
      if (node.type === 'MemberExpression' && node.property.type === 'Identifier' && node.property.name.includes(magicString)) {
        found = {start: node.object.start, end: node.object.end, isSh: false};
      } else if (node.type === 'ShStatement') {
        const shText = fullCode.slice(node.start, node.end);
        if (shText.trim() === magicString)
          found = {start: code.length, end: code.length, isSh: false};
        else if (shText.includes(magicString)) {
          found = {start: node.start, end: node.start + shText.lastIndexOf(magicString), isSh: true};
        }
      }
    };
    MyParser.parse(fullCode, {ecmaVersion: 'latest', allowAwaitOutsideFunction: true, onToken: t => tokens.push(t) });
  } catch(error) {
  }
  gv = before;
  return found;
}

/**
 * @param {string} code
 * @return {import('acorn').Token[]}
 */
function parseCodeIntoTokens(code, globalVars = new Set()) {
  /** @type {import('acorn').Token[]} */
  const tokens = [];
  let before = gv;
  gv = globalVars;
  try {
    MyParser.parse(code, {ecmaVersion: 'latest', allowAwaitOutsideFunction: true, onToken: t => tokens.push(t)});
  } catch(error) {
  }
  gv = before;
  return tokens;
}

/**
 * @param {string} code
 * @return {boolean}
 */
function isShellLike(code, globalVars = new Set()) {
  const tokens = parseCodeIntoTokens(code, globalVars);
  const allowedTokenTypes = new Set([
    shTokenType,
    tokTypes.eof,
  ])
  return !tokens.some(t => !allowedTokenTypes.has(t.type));
}

module.exports = {transformCode, getAutocompletePrefix, parseCodeIntoTokens, isShellLike};