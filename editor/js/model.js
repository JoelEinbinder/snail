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
}