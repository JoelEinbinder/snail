const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');
const http2 = require('http2');

/**
 * @param {string} deviceToken
 * @param {any} payload
 * @param {import('http').ServerResponse=} res
 */
async function notify(deviceToken, payload, res) {
  const signed = jwt.sign({}, fs.readFileSync(path.join(__dirname, 'AuthKey_DDD5CD6DVP.p8')), {
    algorithm: 'ES256',
    keyid: 'DDD5CD6DVP',
    issuer: 'KM96MU7G7A',
  });
  
  const client = http2.connect(`https://api.sandbox.push.apple.com:2197/3/device/${deviceToken}`)
  client.on('stream', console.log);
  const req = client.request({
    authorization: `bearer ${signed}`,
    ':method': 'POST',
    ':path': `/3/device/${deviceToken}`,
    'apns-topic': 'com.joeleinbinder.iOSTerminal',
  });
  req.on('response', e=> {
    console.log(e);
  })
  req.on('error', e=> {
    console.log(e);
  });
  req.write(JSON.stringify(payload), 'utf-8');
  req.end();

  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    //  res?.write(chunk);
  });
  req.on('end', () => {
    client.close();
  });
}
module.exports = {notify};