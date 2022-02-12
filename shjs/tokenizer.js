/**
 * @typedef Token
 * @property {"word"|"operator"|"replacement"|"space"} type
 * @property {string} value
 */
/**
 * @param {string} code
 */
function tokenize(code) {
    /** @type {Token[]} */
    const tokens = [];
    let value = '';
    let inDoubleQuotes = false;
    let inSingleQuotes = false;
    let escaped = false;
    let inOperator = false;
    let inSpace = false;
    let inReplacement = false;
    let i = 0;
    const metaChars = new Set('&|;()<>');
    const operators = new Set([
        '&',
        '&&',
        '|',
        '||',
        ';',
    ])
    for (; i < code.length; i++) {
        const char = code[i];
        const isSpace = ' \t\n'.includes(char);
        if (inOperator) {
            inOperator = false;
            if (operators.has(value + char)) {
                value += char;
                pushToken();
                continue;
            } else {
                pushToken();
                // fall through
            }
        }
        if (inSpace && !isSpace) {
            pushToken();
            inSpace = false;
        }
        if (escaped) {
            escaped = false;
            if (char !== '\n')
                value += char;
        } else if (inSingleQuotes) {
            if (char === '\'')
                inSingleQuotes = false;
            else
                value += char;
        } else if (char === '\\') {
            escaped = true;
        } else if (char === '$') {
            pushToken();
            inReplacement = true;
            const varName = '$' + eatRegex(/[A-Za-z0-9_]/);
            value = varName;
            pushToken();
        } else if (inDoubleQuotes) {
            if (char === '"')
                inDoubleQuotes = false;
            else
                value += char;
        } else if (char === '\'') {
            inSingleQuotes = true;
        } else if (char === '"') {
            inDoubleQuotes = true;
        } else if (char === '~' && value === '' && (!code[i + 1] || '&|;()<> \t\n$'.includes(code[i + 1]))) {
            value = '~';
            inReplacement = true;
            pushToken();
        } else if (isSpace) {
            if (!inSpace)
                pushToken();
            value += char;
            inSpace = true;
        } else if (metaChars.has(char)) {
            pushToken();
            value += char;
            inOperator = true;
        } else {
            value += char;
        }
    }
    pushToken();
    return tokens;
    function pushToken() {
        if (!value) {
            inSpace = false;
            return;
        }
        const type = currentTokenType();
        tokens.push({
            type,
            value,
        });
        value = '';
        inSpace = false;
        inReplacement = false;
    }

    function currentTokenType() {
        if (inSpace)
            return 'space';
        if (inReplacement)
            return 'replacement';
        if (operators.has(value))
            return 'operator';
        return 'word';
    }

    /** @param {RegExp} regex */
    function eatRegex(regex) {
        let result = '';
        while(i + 1 < code.length && regex.test(code[i+1])) {
            result += code[i + 1];
            i++;
        }
        return result;
    }
}

module.exports = {tokenize};