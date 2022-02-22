process.stdin.on('data', () => void 0);
process.stdin.on('end', () => {
  process.exit();
});
require('inspector').open(undefined, undefined, false);

global.bootstrap = () => {
  const binding = global.magic_binding;
  delete global.magic_binding;
  delete global.bootstrap;
  const {sh} = require('../shjs/jsapi');
  global.sh = sh;
  function notify(method, params) {
    binding(JSON.stringify({method, params}));
  }
  /** @type {Map<number, import('node-pty').IPty>} */
  const shells = new Map();
  let shellId = 0;
  let rows = 24;
  let cols = 80;
  global.pty = async function(command) {
    const magicToken = String(Math.random());
    const magicString = `\x33[JOELMAGIC${magicToken}]\r\n`;
    let env = {...process.env};
    const aliases = {};
    let cwd = process.cwd();
    const shell = require('node-pty').spawn('node', [path.join(__dirname, '..', 'shjs', 'wrapper.js'), command, magicToken, JSON.stringify(aliases)], {
      env,
      rows,
      cols,
      cwd,
      name: 'xterm-256color',
      handleFlowControl: true,
      encoding: null,
    });
    const id = ++shellId;
    notify('startTerminal', {id});
    shells.set(id, shell);
    let extraData = '';
    let inExtraData = false;
    shell.onData(d => {
      let data = d.toString();
      if (!inExtraData && data.slice(data.length - magicString.length).toString() === magicString) {
        data = data.slice(0, -magicString.length);
        inExtraData = true;
      }
      if (inExtraData)
        extraData += data;
      else
        notify('data', {id, data});
    });
    /** @type {{exitCode: number, signal?: number}} */
    const returnValue = await new Promise(x => shell.onExit(x));
    shells.delete(id);
    if (extraData.length) {
      const changes = JSON.parse(extraData);
      if (changes.cwd) {
        cwd = changes.cwd;
        process.chdir(cwd);
        notify('cwd', changes.cwd);
      }
      if (changes.env) {
        for (const key in changes.env) {
          env[key] = changes.env[key];
          process.env[key] = changes.env[key];
        }
        notify('env', changes.env);
      }
      if (changes.aliases) {
        const {setAlias} = require('../shjs/index');
        notify('aliases', changes.aliases);
        for (const key of Object.keys(changes.aliases)) {
          setAlias(key, changes.aliases[key]);
          aliases[key] = changes.aliases[key];
        }
      }
    }
    notify('endTerminal', {id, returnValue});
    return 'this is the secret secret string';
  }
  const handler = {
    input({id, data}) {
      if (!shells.has(id))
        return;
      shells.get(id).write(data);
    },
    resize(size) {
      rows = size.rows;
      cols = size.cols;
      for (const shell of shells.values())
        shell.resize(size.cols, size.rows);
    }
  }
  return function respond(data) {
    const {method, params} = data;
    handler[method](params);
  }
};