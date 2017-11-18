class Model extends Emitter {
    /**
     * @param {string} data
     */
    constructor(data) {
        super();
        this._lines = data.split('\n');
    }

    line(i) {
        return this._lines[i];
    }

    lineCount() {
        return this._lines.length;
    }
}