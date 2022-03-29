const {EventEmitter} = require('events');
const {handler} = require('../host/');
const {PipeTransport} = require('../protocol/pipeTransport');
process.stdin.on('end', () => process.exit());
const transport = new PipeTransport(process.stdout, process.stdin);

const overrides = {
  ...handler,
  async test(params, sender) {
    return 123;
  }
};
const client = new EventEmitter();
client.send = message => transport.send(message);
transport.onmessage = async (message) => {
  const {method, params, id} = message;
  let error;
  if (!overrides.hasOwnProperty(method)) {
    error = new Error('command not found: ' + method);
  } else {
    try {
      const result = await overrides[method](params, client);
      if (id)
        transport.send({result, id});
      return;
    } catch (e) {
      error = e;
    }
  }
  if (id)
    transport.send({error: String(error), id});
};