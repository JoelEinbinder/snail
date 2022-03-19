/**
 * @typedef Token
 * @property {"word"|"operator"|"replacement"|"space"|"glob"} type
 * @property {boolean=} isQuoted
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
    let tokenStart = 0;
    let couldBeOperator = true;
    let i = 0;
    const metaChars = new Set('&|()<>*');
    const operators = new Set([
        '&',
        '&&',
        '|',
        '||',
        ';',
        '*'
    ]);
    for (; i < code.length; i++) {
        const char = code[i];
        const isSpace = ' \t'.includes(char);
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
            couldBeOperator = false;
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
            couldBeOperator = false;
        } else if (char === '"') {
            inDoubleQuotes = true;
            couldBeOperator = false;
        } else if (char === '~' && value === '' && (!code[i + 1] || '&|;()<> \t\n$/'.includes(code[i + 1]))) {
            value = '~';
            inReplacement = true;
            pushToken();
        } else if (isSpace) {
            if (!inSpace)
                pushToken();
            value += char;
            inSpace = true;
        } else if (char === ';' || char === '\n') {
            break;
        } else if (metaChars.has(char)) {
            pushToken();
            value += char;
            inOperator = true;
        } else {
            value += char;
        }
    }
    pushToken();
    return {tokens, raw: code.substring(0, i)};
    function pushToken() {
        if (!value && tokenStart >= i) {
            inSpace = false;
            tokenStart = i;
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
        couldBeOperator = true;
        tokenStart = i + 1;
    }

    function currentTokenType() {
        if (inSpace)
            return 'space';
        if (inReplacement)
            return 'replacement';
        if (!couldBeOperator)
            return 'word';
        if (value === '*')
            return 'glob';
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