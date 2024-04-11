/**
 * @typedef Token
 * @property {"word"|"operator"|"replacement"|"template"|"space"|"glob"|"comment"} type
 * @property {boolean=} isQuoted
 * @property {string} value
 * @property {string} raw
 */
/**
 * @param {string} code
 * @param {(code: string) => string} processTemplateParameter
 */
function tokenize(code, processTemplateParameter = null) {
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
    let inTemplateParameter = false;
    let inComment = false;
    let i = 0;
    const metaChars = new Set('&|()<>*');
    const operators = new Set([
        '&',
        '&&',
        '|',
        '||',
        ';',
        '*',
        '>',
        '<',
    ]);
    for (; i < code.length; i++) {
        const char = code[i];
        const isSpace = ' \t'.includes(char);
        if (inComment) {
            if (char === '\n') {
                inComment = false;
                pushToken(true);
            } else {
                value += char;
            }
            continue;
        }
        if (inOperator) {
            inOperator = false;
            if (operators.has(value + char)) {
                value += char;
                pushToken(true);
                continue;
            } else {
                pushToken(false);
                // fall through
            }
        }
        if (inSpace && !isSpace) {
            pushToken(false);
            inSpace = false;
        }
        if (escaped) {
            escaped = false;
            if (char !== '\n')
                value += char;
        } else if (inSingleQuotes) {
            if (char === '\'') {
                pushToken(true);
                inSingleQuotes = false;
            } else {
                value += char;
            }
        } else if (char === '\\') {
            couldBeOperator = false;
            escaped = true;
        } else if (char === '$') {
            pushToken(false);
            if (code[i + 1] === '{') {
                i += 1; // for the {;
                const templateParameter = processTemplateParameter(code.slice(i + 1));
                i += templateParameter.length;
                i += 1; // for the }
                value = templateParameter;
                inTemplateParameter = true;
                pushToken(true);
            } else {
                inReplacement = true;
                const varName = '$' + eatRegex(/[A-Za-z0-9_]/);
                value = varName;
                pushToken(true);
            }
        } else if (inDoubleQuotes) {
            if (char === '"') {
                pushToken(true);
                inDoubleQuotes = false;
            } else {
                value += char;
            }
        } else if (char == '#') {
            pushToken(false);
            inComment = true;
            value = '';
        } else if (char === '\'') {
            pushToken(false);
            inSingleQuotes = true;
            couldBeOperator = false;
        } else if (char === '"') {
            pushToken(false);
            inDoubleQuotes = true;
            couldBeOperator = false;
        } else if (char === '~' && value === '' && (!code[i + 1] || '&|;()<> \t\n$/'.includes(code[i + 1]))) {
            value = '~';
            inReplacement = true;
            pushToken(false);
        } else if (isSpace) {
            if (!inSpace)
                pushToken(false);
            value += char;
            inSpace = true;
        } else if (char === ';' || char === '\n') {
            break;
        } else if (metaChars.has(char)) {
            pushToken(false);
            value += char;
            inOperator = true;
        } else {
            value += char;
        }
    }
    pushToken(false);
    return {tokens, raw: code.substring(0, i)};
    /**
     * @param {boolean} inclusive
     */
    function pushToken(inclusive) {
        if (!value && tokenStart >= (inclusive ? i + 1 : i)) {
            inSpace = false;
            console.assert(tokenStart === i, 'multitoken empty token');
            tokenStart = i;
            return;
        }
        const type = currentTokenType();
        const raw = code.substring(tokenStart, inclusive ? i + 1 : i);
        /** @type {Token} */
        const token = {
            type,
            value,
            raw,
        };
        if (inDoubleQuotes || inSingleQuotes)
            token.isQuoted = true;
        tokens.push(token);
        value = '';
        inSpace = false;
        inReplacement = false;
        inTemplateParameter = false;
        couldBeOperator = true;
        tokenStart = inclusive ? i + 1 : i;
    }

    function currentTokenType() {
        if (inComment)
            return 'comment';
        if (inSpace)
            return 'space';
        if (inReplacement)
            return 'replacement';
        if (inTemplateParameter)
            return 'template';
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