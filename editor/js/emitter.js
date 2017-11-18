class Emitter {
  constructor() {
    /**
     * @private
     * @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * @param {string} eventName
   * @param {function(Object=)} listener
   */
  on(eventName, listener) {
    var set = this._listeners.get(eventName);
    if (!set)
      this._listeners.set(eventName, set = new Set());
    set.add(listener);
  }

  /**
   * @param {string} eventName
   * @param {function(Object=)} listener
   * @return {boolean}
   */
  off(eventName, listener) {
    var set = this._listeners.get(eventName);
    if (!set)
      return false;
    return set.delete(listener);
  }

  /**
   * @param {string} eventName
   * @param {Object=} data
   */
  emit(eventName, data) {
    var set = this._listeners.get(eventName);
    if (!set)
      return;
    set.forEach(listener => listener(data));
  }

  /**
   * @param {string} eventName
   * @return {Promise<*>}
   */
  once(eventName) {
    var fulfill;
    var promise = new Promise(x => fulfill = x);
    var listener = data => {
      this.off(eventName, listener);
      fulfill(data);
    };
    this.on(eventName, listener);
    return promise;
  }
}
