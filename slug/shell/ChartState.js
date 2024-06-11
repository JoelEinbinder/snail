class ChartState {
  _nextStep = 0;
  data = [];
  _count = 0;
  appendData(data) {
    data = normalizeData(data);
    if (!data)
      return;
    if (typeof data.step !== 'number')
        data.step = this._nextStep;
    if (typeof data.wallTime !== 'number')
        data.wallTime = Date.now();
    this._nextStep = data.step + 1;
    const DATA_LIMIT = 100_000;
    if (this.data.length < DATA_LIMIT)
      this.data.push(data);
    else {
      const index = Math.floor(Math.random() * this._count);
      if (index < DATA_LIMIT)
        this.data[index] = data;
    }
    this._count++;
  }
}

/**
 * @param {number|object} data
 * @return {null|object}
 */
function normalizeData(data) {
  if (typeof data === 'number')
    return { value: data };
  if (typeof data === 'object')
    return data;
  return null;
}

module.exports = { ChartState };