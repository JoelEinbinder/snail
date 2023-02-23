const fs = require('fs');
const path = require('path');
const pathService = require('../path_service/');
/**
 * @typedef {{
 *  sshArgs: string[],
 *  sshAddress: string,
 *  env: Record<string, string>,
 *  askPass: (data: any) => Promise<string>,
 *  onclose: () => void,
 *  ondata: (data: Buffer) => void,
 * }} SSHSubshellDelegate
 */


let askpassUniqueId = 0;
/**
 * @param {SSHSubshellDelegate} delegate
 */
async function createSSHSubshell(delegate) {
  const {spawn} = require('child_process');
  /** @type {import('../protocol/ProtocolProxy').ProtocolSocket} */
  const socket = {
    send(message) {
      rpc.notify('message', message);
    },
    close() {
      child.kill();
    },
  };
  const {SSHPassUtility} = require('./sshPassUtility');
  const sshDir = path.join(pathService.tmpdir(), 'snail-ssh-askpass');
  fs.mkdirSync(sshDir, {recursive: true, mode: 0o700});
  const sshPassSocketPath = path.join(sshDir, `${process.pid}-ssh-${++askpassUniqueId}.socket`);
  const utility = new SSHPassUtility(sshPassSocketPath, delegate.askPass);
  await utility.listeningPromise;
  // https://github.com/xxorax/node-shell-escape MIT
  function shellescape(s) {
    if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
      s = "'"+s.replace(/'/g,"'\\''")+"'";
      s = s.replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
        .replace(/\\'''/g, "\\'" ); // remove non-escaped single-quote if there are enclosed between 2 escaped
    }
    return s;
  }    
  const launchArg = btoa(JSON.stringify({socketPath: undefined}));
  const execute = [
    `SNAIL_VERSION=${JSON.stringify(require('../package.json').version)}`,
    `SNAIL_SLUGS_URL=${shellescape(delegate.env.SNAIL_SLUGS_URL || 'https://joel.tools/slugs')}`,
    `SNAIL_NODE_URL=${shellescape(delegate.env.SNAIL_NODE_URL || 'https://nodejs.org/dist')}`,
    `sh -c ${shellescape(fs.readFileSync(path.join(__dirname, './download-slug-if-needed-and-run.sh'), 'utf8'))}`,
  ].join(' ');
  const child = spawn('ssh', [...delegate.sshArgs, delegate.sshAddress, execute], {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
    cwd: process.cwd(),
    env: {
      ...delegate.env,
      PWD: process.cwd(),
      SSH_ASKPASS: path.join(__dirname, './sshAskpass.js'),
      SNAIL_SSH_PASS_SOCKET: sshPassSocketPath,
      SSH_ASKPASS_REQUIRE: 'force',
    }
  });
  child.stderr.on('data', data => delegate.ondata(data));
  const {RPC} = require('../protocol/rpc-js');
  const {PipeTransport} = require('../protocol/pipeTransport');
  const pipeTransport = new PipeTransport(child.stdin, child.stdout);
  const rpc = RPC(pipeTransport, {
    message: data => {
      socket.onmessage?.({data});
    },
    ready: () => {
      socket.onopen?.();
    }
  });
  pipeTransport.onclose = () => {
    delegate.onclose();
    utility.close();
  };
  return {
    socket,
    closePromise: /** @type {Promise<void>} */ (new Promise(x => child.once('close', x))),
    getExitCode: () => child.exitCode,
  };
}

module.exports = { createSSHSubshell };