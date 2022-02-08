const {tokenize} = require('./tokenizer');

/**
 * @param {import('./tokenizer').Token[]} tokens
 * @return {import('./ast').Expression}
 */
function parse(tokens) {
    if (!tokens.length)
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
 * @return {string[]}
 */
 function parseArgs(tokens) {
    const args = [];
    while (tokens.length && tokens[0].type === 'word')
        args.push(tokens.shift().value);
    return args;
 }
 
 module.exports = {parse};