class Highlighter {
    /**
     * @param {Model} model
     */
    constructor(model) {
        this._model = model;
    }

    /**
     * @param {number} lineNumber
     * @return {Array<{text: string, color: string}>}
     */
    tokensForLine(lineNumber) {
        var line = this._model.line(lineNumber);
        var retVal = [];
        for (var i = 0; i < line.length; i+=4) {
            var color = i % 8 ? '#F00' : '#00F';
            retVal.push({text: line.substring(i, i+4), color});
        }
        return retVal;
    }
}