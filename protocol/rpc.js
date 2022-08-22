
/**
 * @typedef {Object} ProtocolRequest
 * @property {number=} id
 * @property {string} method
 * @property {any=} params
 */
/**
 * @typedef {Object} ProtocolResponse
 * @property {number} id
 * @property {any=} result
 */
/**
 * @param {{
 *  send: (message: ProtocolResponse|ProtocolRequest) => void,
 *  onmessage?: ((message: ProtocolResponse|ProtocolRequest) => void),
 * }} transport
 * @param {any} reciever
 */
function RPC(transport, reciever) {
  let lastId = 0;
  /** @type {Map<number, (value: any) => void>} */
  const callbacks = new Map();
  transport.onmessage = async message => {
    const {method, params, id, result, error} = message;
    if (method) {
      try {
        const result = await reciever[method](params);
        if (id)
          transport.send({id, result})
      } catch(error) {
        if (id)
          transport.send({id, error: {message: error.message}})
      }
    } else {
      const callback = callbacks.get(id);
      if (error)
        console.error(error);
      if (callback)
        callback(result);
    }
  };
  return {
    /**
     * @param {string} method
     * @param {any} params
     */
    async send(method, params) {
      return send(method, params, false);
    },
    /**
     * @param {string} method
     * @param {any} params
     */
    notify(method, params) {
      send(method, params, true);
    }
  };
  /**
   * @param {string} method
   * @param {any} params
   * @param {boolean} isNotify
   */
  function send(method, params, isNotify) {
    const id = isNotify ? null : ++lastId;
    transport.send({id, method, params});
    if (id === null)
      return;
    return new Promise(x => {
      callbacks.set(id, value => {
        callbacks.delete(id);
        x(value);
      });
    });
  }
}

module.exports = {RPC};