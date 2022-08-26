module.exports = {
  /**
   * @param {import('ws')} socket
   */
  connect: (socket, request, oid) => {
    require('./web_host/index').onConnect(socket, request, oid);
  }
}
