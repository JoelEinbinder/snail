import type {Runtime} from '../slug/shell/runtime-types';
//@ts-ignore
import 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js'
import runtimeSource from './runtime.py';
import cdpHandlerSource from '../slug/shell/python/cdp_handler.py';
import pltBackendSource from '../slug/shell/python/modules/_snail_plt_backend.py';

declare var loadPyodide: typeof import('pyodide').loadPyodide;
const pyodide = await loadPyodide({
  env: {
    MPLBACKEND: 'module://_snail_plt_backend',
  }
});
pyodide.FS.writeFile('cdp_handler.py', cdpHandlerSource);
pyodide.FS.mkdir('modules');
pyodide.FS.writeFile('modules/_snail_plt_backend.py', pltBackendSource);

let lastTerminalId = 0;

class StdinCooker {
  _cooked = '';
  write(data: Uint8Array) {
    const writeBuffer = [];
    for (const byte of data) {
      let char = String.fromCharCode(byte);
      // TODO this could be a lot smarter. handling arrow keys and such
      // Where is the source of truth for this logic on unix systems?
      if (char === '\r') {
        this._cooked += '\n';
        writeBuffer.push('\n'.charCodeAt(0));
      } else if (char === '\x7f') {
        if (this._cooked.length) {
          this._cooked = this._cooked.slice(0, -1);
          writeBuffer.push(8, 32, 8);
        }
      } else {
        this._cooked += char;
        writeBuffer.push(byte);
      }
    }
    return new Uint8Array(writeBuffer);
  }
  popLine(maxLength: number) {
    const lineIndex = this._cooked.indexOf('\n')
    if (lineIndex === -1)
      return null;
    const line = this._cooked.slice(0, lineIndex + 1);
    if (line.length > maxLength) {
      this._cooked = this._cooked.slice(maxLength + 1);
      return line.slice(0, maxLength);
    }
    this._cooked = this._cooked.slice(lineIndex + 2);
    return line;
  }
}

class PythonController {
  _sendRuntimeNotification: <T extends keyof Runtime>(method: T, params: Runtime[T]) => void;
  _terminalId:string|null = null; // we shouldn't have any stdout on startup. Sending startTerminal will clear the prompt
  _threadStdio: () => Promise<void>;
  _ignoreStdio = 0;
  constructor(notificationListener: (notification: any) => void) {
    console.log();
    this._sendRuntimeNotification = (method, params) => {
      notificationListener({
        method: 'Shell.notify',
        params: {payload: { method, params }}
      });
    }

    let threadCallback: () => void = null;
    let last = '';
    let magicString = '';
    const onData = (d: Uint8Array) => {
      if (this._ignoreStdio) {
        console.warn(new TextDecoder().decode(d));
        return d.length;
      }
      let data = last + new TextDecoder().decode(d).replace(/\n/g, '\r\n');
      const sendData = () => {
        if (!this._terminalId)
          this._startNewTerminal();
        this._sendRuntimeNotification('data', {
          id: this._terminalId,
          data,
        });
      }
      if (threadCallback && data.slice(data.length - magicString.length).toString() === magicString) {
        data = data.slice(0, -magicString.length);
        if (data) {
          sendData();
          last = '';
        }
        const cb = threadCallback;
        threadCallback = null;
        cb();
        return d.length;
      }
      const magicMaybeStart = data.lastIndexOf(magicString[0]);
      if (magicMaybeStart !== -1 && magicString.startsWith(data.slice(magicMaybeStart))) {
        last = data.slice(magicMaybeStart);
        data = data.slice(0, magicMaybeStart);
      } else {
        last = '';
      }
      if (data)
        sendData();
      return d.length;
    };
    pyodide.setStderr({ isatty: true, write: onData });
    pyodide.setStdout({ isatty: true, write: onData });
    const stdinCooker = new StdinCooker();
    pyodide.setStdin({
      isatty: true,
      read: buffer => {
        if (!buffer.byteLength)
          return 0;
        if (!inputBuffer)
          return 0;
        const sizeBuffer = new Int32Array(inputBuffer);
        while (true) {
          const line = stdinCooker.popLine(buffer.length);
          if (line) {
            const encoded = new TextEncoder().encode(line);
            buffer.set(encoded);
            return encoded.length;
          }
          Atomics.wait(sizeBuffer, 0, 0);
          const size = sizeBuffer[0];
          onData(stdinCooker.write(new Uint8Array(inputBuffer.slice(4), 0, size)))
          sizeBuffer[0] = 0;
        }
      }
    });
    pyodide.runPython(runtimeSource, {
      filename: 'runtime.py',
    });
    this._threadStdio = async () => {
      const magicToken = String(Math.random());
      magicString = `\x1B[JOELMAGIC${magicToken}]`;
      const promise = new Promise<void>(resolve => threadCallback = resolve);
      await this.send('Python.threadStdio', {
        text: magicString,
      });
      return promise;
    }
  }

  _startNewTerminal() {
    this._terminalId = 'python-' + lastTerminalId++;
    this._sendRuntimeNotification('startTerminal', { id: this._terminalId })
  }

  _endTerminal() {
    this._sendRuntimeNotification('endTerminal', { id: this._terminalId })
    this._terminalId = null;
  }

  sendInput(data) {
    // this._stream.write(data);
    console.log('TODO implement sendInput', data);
    // TODO can maybe be done with a SharedArrayBuffer and Atomics
  }

  resize({rows, cols}) {
    // TODO pyoidide doesn't support resizing?
  }

  async runCommand(expression) {
    this._startNewTerminal();
    await pyodide.loadPackagesFromImports(expression);
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: false,
      generatePreview: true,
      userGesture: true,
      replMode: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    await this._threadStdio();
    this._endTerminal();
    return result;    
  }

  send(method, params) {
    if (method === 'Shell.runCommand')
      return this.runCommand(params.expression);
    const shouldPause = shouldPauseOnMethod(method);
    if (shouldPause)
      this._ignoreStdio++;
    const out = pyodide.runPython(`handle_json_line(${JSON.stringify(JSON.stringify({method, params}))})`, {

    })
    if (shouldPause)
      this._ignoreStdio--;
    const result = JSON.parse(out);
    return result;
    // return this._rpc.send(method, params);
    
  }

  notify(method, params) {
    // this._rpc.notify(method, params);
    console.log('TODO implement notify', method, params);
  }

  close() {
    // this.process.kill();
  }
}

function shouldPauseOnMethod(method) {
  return method === 'Python.autocomplete';
}



function dispatch(message) {
  self.postMessage(message);
}

// hookConsole(dispatch);
const controller = new PythonController(dispatch);

let inputBuffer: SharedArrayBuffer|null = null;
self.addEventListener('message', event => {
  if (event.data.method === 'setup_input_buffer') {
    inputBuffer = event.data.params;
    return;
  }
  protocol(event.data);
});
async function protocol(message) {
  const { method, id, params = {} } = message;
  try {
    const result = await controller.send(method, params);;
    dispatch({ id, result });
  } catch (error) {
    console.log('protocol', error);
    dispatch({ id, error });
  }
}
self.postMessage('ready');

export {}