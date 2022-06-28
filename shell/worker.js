//@ts-check
const {PipeTransport} = require('../protocol/pipeTransport');
const {RPC} = require('../protocol/rpc');
const transport = new PipeTransport(process.stdout, process.stdin);
process.stdin.on('close', () => process.exit());

const rpc = RPC(transport, {
  /** @param {string} code */
  async evaluate(code) {
    const {getResult} = require('../shjs/index');
    const {output} = await getResult(code);
    return output;
  },
  /** @param {string} dir */
  async chdir(dir) {
    process.chdir(dir || require('os').homedir());
  },
  async env(env) {
    for (const [key, value] of Object.entries(env))
      process.env[key] = value;
  },
  async requestFile(filePath) {
    return require('fs').readFileSync(filePath).toString('base64');
  },
  async resolveFileForIframe({filePath, headers}) {
    if (headers.Accept && headers.Accept.includes('text/html')) {
      return {
        statusCode: 200,
        data: Buffer.from(new TextEncoder().encode(`<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="${require.resolve('../iframe/iframe.css')}">
  <script src="${require.resolve('../iframe/runtime.js')}" type="module"></script>
</head>
<body>
<script src="${filePath}" type="module"></script>
</body>
</html>`)).toString('base64'),
        mimeType: 'text/html',
      };
    }
    return {
      data: require('fs').readFileSync(filePath).toString('base64'),
      statusCode: 200,
      mimeType: require('mime-types').lookup(filePath) || undefined,
    };
  }
});
