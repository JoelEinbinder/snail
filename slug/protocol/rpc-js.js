
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
 * @property {any=} error
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
    if ('method' in message) {
      const {params, method, id} = message;
      try {
        const result = typeof reciever === 'function' ? await reciever({method, params}) : await reciever[method](params);
        if (id)
          transport.send({id, result})
      } catch(error) {
        if (id)
          transport.send({id, error: {message: error.message, method}})
      }
    } else {
      const {id, result, error} = message;
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