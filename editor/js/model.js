class Model extends Emitter {
    /**
     * @param {string} data
     */
    constructor(data) {
        super();
        this._lines = data.split('\n');
        this._longestLineLength = 0;
        for (var line of this._lines) {
            this._longestLineLength = Math.max(this._longestLineLength, line.length);
        }
        /** @type {Array<Sel>} */
        this._selections = [{start: {line: 0, column: 0}, end: {line: 0, column: 0}}];
    }

    longestLineLength() {
        return this._longestLineLength;
    }

    /**
     * @param {number} from
     * @param {number} to
     * @return {number}
     */
    charCountForLines(from, to) {
        var total = 0;
        for (var i = from; i <= to; i++)
            total += this._lines[i].length;
        return total;
    }

    /**
     * @param {number} i
     * @return {string}
     */
    line(i) {
        return this._lines[i];
    }

    lineCount() {
        return this._lines.length;
    }

    setSelections(selections) {
        this._selections = selections;
    }

    get selections() {
        return this._selections;
    }
}

/**
 * @typedef {Object} Loc
 * @property {number} column
 * @property {number} line
 */

/**
 * @typedef {Object} Sel
 * @property {Loc} start
 * @property {Loc} end
 */
