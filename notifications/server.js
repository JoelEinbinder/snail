const http = require('http');
const { notify } = require('./notify');
let deviceToken;
http.createServer(async (req, res) => {
  try {
    console.log(req.method, req.url);
    if (req.url === '/register' && req.method === 'POST') {
      const json = await readJSONBody(req);
      const deviceTokenBuffer = Buffer.from(json.deviceToken, 'base64');
      
      deviceToken = [...deviceTokenBuffer].map(x => x.toString(16).padStart(2, '0')).join('');    
      res.writeHead(204);
      res.end();
    } else if (req.url === '/notify' && req.method === 'POST') {
      const json = await readJSONBody(req);
      await notify(deviceToken, json);
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(404);
      res.end('url not found');
    }
  } catch (e) {
    res.writeHead(500);
    res.end('Threw an error');
    console.error(e);
  }
}).listen(26394);

async function readJSONBody(req) {
  let bodyParts = [];
  req.on('data', chunk => {
    bodyParts.push(chunk);
  });
  await new Promise(x => req.once('end', x));
  const body = Buffer.concat(bodyParts).toString('utf-8');
  return JSON.parse(body);
}

// const payload = {
//   "aps" : {
//      "alert" : {
//         "title" : "Joel Terminal",
//         "subtitle" : "A notification",
//         "body" : "It works!"
//      },
//      "sound" : "default",
//   },
// };