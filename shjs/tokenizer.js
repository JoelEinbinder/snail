/**
 * @typedef Token
 * @property {"word"|"operator"} type
 * @property {string} value
 */
/**
 * @param {string} code
 */
function tokenize(code) {
    /** @type {Token[]} */
    const tokens = [];
    let value = '';
    let clean = true;
    let inDoubleQuotes = false;
    let inSingleQuotes = false;
    let escaped = false;
    let inOperator = false;
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
        if (escaped) {
            escaped = false;
            if (char !== '\n')
                value += char;
            else if (value === '')
                clean = true;
        } else if (inSingleQuotes) {
            if (char === '\'')
                inSingleQuotes = false;
            else
                value += char;
        } else if (char === '\\') {
            clean = false;
            escaped = true;
        } else if (inDoubleQuotes) {
            if (char === '"')
                inDoubleQuotes = false;
            else
                value += char;
        } else if (char === '\'') {
            inSingleQuotes = true;
            clean = false;
        } else if (char === '"') {
            inDoubleQuotes = true;
            clean = false;
        } else if (' \t\n'.includes(char)) {
            pushToken();
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
            clean = true;
            return;
        }
        const type = (clean && operators.has(value)) ? 'operator' : 'word';
        if (type === 'word' && value.startsWith('~')) {
            if (value.length === 1 || value[1] === '/')
                value = process.env.HOME + value.slice(1);
        }
        tokens.push({
            type,
            value,
        });
        clean = true;
        value = '';
    }
}

module.exports = {tokenize};