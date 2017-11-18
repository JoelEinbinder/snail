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

    line(i) {
        return this._lines[i];
    }

    lineCount() {
        return this._lines.length;
    }
}