const {tokenize} = require('./tokenizer');

/**
 * @param {import('./tokenizer').Token[]} tokens
 * @return {import('./ast').Expression}
 */
function parse(tokens) {
    for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].type === 'comment')
            tokens.splice(i, 1);
    }
    if (!eatSpaces(tokens))
        return null;
    if (tokens[0].type === 'operator') {
        const token = tokens.shift();
        switch(token.value) {
            case ';':
                return parse(tokens);
            default:
                throw new Error(`Unexpected operator: ${token.value}`);
        }
    }

    const {executable, assignments} = parseExecutableAndAssignments(tokens);
    const {args, redirects} = parseArgsAndRedirects(tokens);
    const main = {
        executable,
        args,
        assignments,
        redirects: redirects.length ? redirects : undefined,
    };
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

function parseExecutableAndAssignments(tokens) {
    /** @type {import('./ast').Assignment[]} */
    const assignments = [];
    while (tokens.length) {
        const word = parseWord(tokens);
        const assignment = getAssignment(word);
        if (!assignment) {
            if (!assignments.length)
                return {executable: word};
            return {
                executable: word,
                assignments,
            };
        }
        assignments.push(assignment);
        eatSpaces(tokens);
    }
    throw new Error('Expected an executable');
}

/**
 * @param {import('./ast').Word} word
 * @return {import('./ast').Assignment}
 */
function getAssignment(word) {
    let prefix = '';
    let hasEqual = false;
    /** @type {import('./ast').Word} */
    const value = [];
    for (const part of word) {
        if (hasEqual) {
            value.push(part);
            continue;
        }
        if (typeof part !== 'string')
            return null;
        if (part.includes('=')) {
            hasEqual = true;
            const index = part.indexOf('=');
            prefix += part.substring(0, index); 
            value.push(part.substring(index + 1));
        } else {
            prefix += part;
        }
    }
    if (!hasEqual)
        return null;
    return {
        name: prefix,
        value,
    }
}

/**
 * @param {import('./tokenizer').Token[]} tokens
 * @return {{args: import('./ast').Word[], redirects?: import('./ast').Redirect[]}}
 */
function parseArgsAndRedirects(tokens) {
    const args = [];
    /** @type {import('./ast').Redirect[]} */
    const redirects = [];
    while (true) {
        while (eatSpaces(tokens) && tokens[0].type !== 'operator') {
            args.push(parseWord(tokens));
        }
        const isOperator = tokens[0]?.type === 'operator';
        if (isOperator && tokens[0].value === '>') {
            tokens.shift();
            eatSpaces(tokens);
            redirects.push({
                type: 'write',
                from: 1,
                to: parseWord(tokens),
            });
        } else if (isOperator && tokens[0].value === '<') {
            tokens.shift();
            eatSpaces(tokens);
            redirects.push({
                type: 'read',
                from: 0,
                to: parseWord(tokens),
            });            
        } else {
            break;
        }
    }
    return {args, redirects};
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
    while (tokens.length && (tokens[0].type === 'word' || tokens[0].type === 'replacement' || tokens[0].type === 'glob')) {
        const token = tokens.shift();
        switch(token.type) {
            case 'word':
                word.push(token.value);
                break;
            case 'replacement':
                word.push({replacement: token.value});
                break;
            case 'glob':
                word.push({glob: token.value});
                break;
            default:
                throw new Error(`Unexpected token: ${token.type}`);
        }
    }
    return word.some(x => typeof x !== 'string') ? word : word.join('');
}

module.exports = {parse};
