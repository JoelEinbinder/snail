
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
  /** @type {Map<number, {resolve: (value: any) => void, reject: (error: any) => void}>} */
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
      if (callback) {
        if (error)
          callback.reject(error);
        else
          callback.resolve(result);
      } else if (error) {
        console.error(error);
      }
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
    const id = isNotify ? undefined : ++lastId;
    transport.send({id, method, params});
    if (id === undefined)
      return;
    return new Promise((resolve, reject) => {
      callbacks.set(id, {
        resolve: value => {
          callbacks.delete(id);
          resolve(value);
        },
        reject: error => {
          callbacks.delete(id);
          reject(error);
        }
      });
    });
  }
}

module.exports = {RPC};