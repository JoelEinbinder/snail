const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');
const base64 = 'dIrgRo+8JiNss5saigXK0ehPZDnkD2ju3cHxWrSeTWI=';
const buffer = Buffer.from(base64, 'base64');

const deviceToken = [...buffer].map(x => x.toString(16).padStart(2, '0')).join('');
// console.log(deviceToken);

console.time('sign');
const signed = jwt.sign({}, fs.readFileSync(path.join(__dirname, 'AuthKey_DDD5CD6DVP.p8')), {
  algorithm: 'ES256',
  keyid: 'DDD5CD6DVP',
  issuer: 'KM96MU7G7A',
});
console.timeEnd('sign');
const payload = {
  "aps" : {
     "alert" : {
        "title" : "Joel Terminal",
        "subtitle" : "A notification",
        "body" : "It works!"
     },
     "sound" : "default",
  },
};// console.log(signed);
// const fetch = require('node-fetch');
const http2 = require('http2');
(async () => {

  const client = http2.connect(`https://api.sandbox.push.apple.com:2197/3/device/${deviceToken}`)
  console.log('ran connect');
  client.on('error', e => {
    console.error(e);
  })
  client.on('connect', e => {
    console.log('connected?');
  });
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
  let data = '';
  req.on('data', (chunk) => {
    console.log('request data', chunk);
     data += chunk;
    });
  req.on('end', () => {
    console.log(`\n${data}`);
    client.close();
  });
  console.log('done it all');
  // client.close();

})();
