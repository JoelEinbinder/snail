const {tokenize} = require('./tokenizer');

/**
 * @param {import('./tokenizer').Token[]} tokens
 * @return {import('./ast').Expression}
 */
function parse(tokens) {
    if (!eatSpaces(tokens))
        return null;
    const token = tokens.shift();
    if (token.type === 'operator') {
        switch(token.value) {
            case ';':
                return parse(tokens);
            default:
                throw new Error(`Unexpected operator: ${token.value}`);
        }
    }

    const executable = token.value;
    const args = parseArgs(tokens);
    const main = {executable, args};
    if (!tokens.length) {
        return main
    }
    const nextToken = tokens.shift();
    if (nextToken.type !== 'operator')
        throw new Error('Internal error, expected operator');
    switch (nextToken.value) {
        case '|':
            const pipe = parse(tokens);
            if (tokens.length)
                throw new Error('Internal error, expected end of tokens');
            return {
                main,
                pipe,
            };
        case '&&':
        case '||':
            const right = parse(tokens);
            if (tokens.length)
                throw new Error('Internal error, expected end of tokens');
            return {
                type: nextToken.value === '&&' ? 'and' : 'or',
                left: main,
                right,
            };
        default:
            throw new Error(`Unexpected operator: ${nextToken.value}`);
    }

}

/**
 * @param {import('./tokenizer').Token[]} tokens
 * @return {import('./ast').Word[]}
 */
function parseArgs(tokens) {
    const args = [];
    while (eatSpaces(tokens) && tokens[0].type !== 'operator') {
        args.push(parseWord(tokens));
    }
    return args;
}

/**
 * @param {import('./tokenizer').Token[]} tokens
 */
 function eatSpaces(tokens) {
    while (tokens.length && tokens[0].type === 'space')
        tokens.shift();
    return !!tokens.length;
 }

/**
 * @param {import('./tokenizer').Token[]} tokens
 * @return {import('./ast').Word}
 */
function parseWord(tokens) {
    /** @type {import('./ast').Word} */
    const word = [];
    while (tokens.length && (tokens[0].type === 'word' || tokens[0].type === 'replacement')) {
        const token = tokens.shift();
        switch(token.type) {
            case 'word':
                word.push(token.value);
                break;
            case 'replacement':
                word.push({replacement: token.value});
                break;
            default:
                throw new Error(`Unexpected token: ${token.type}`);
        }
    }
    return word.some(x => typeof x !== 'string') ? word : word.join('');
}

module.exports = {parse};
