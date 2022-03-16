import 'xterm/css/xterm.css';
import { addHistory, updateHistory } from './history';
import { makePromptEditor } from './PromptEditor';
import { JoelEvent } from './JoelEvent';
import type { LogItem } from './LogView';
import { CommandBlock, CommandPrefix, computePrettyDirName } from './CommandBlock';
import { TerminalBlock } from './TerminalBlock';
import { JSConnection } from './JSConnection';
import { JSBlock, JSLogBlock, renderRemoteObjectOneLine } from './JSBlock';
import { preprocessForJS, isUnexpectedEndOfInput } from './PreprocessForJS';
import type { Suggestion } from './autocomplete';
import { titleThrottle } from './UIThrottle';

const shells = new Map<number, Shell>();
const socketListeners = new Map<number, (message: string) => void>();
const size = {
  rows: 0,
  cols: 0,
}
const PADDING = 4;
function updateSize() {
  const {width, height} = measureChar();
  const padding = PADDING / window.devicePixelRatio;
  size.cols = Math.floor((window.innerWidth - padding * 2) / width);
  size.rows = Math.floor((window.innerHeight - padding * 2) / height);
  for (const shell of shells.values())
    shell.updateSize();
}
window.addEventListener('resize', updateSize);
updateSize();

window.electronAPI.onEvent('websocket', ({socketId, message}) => {
  socketListeners.get(socketId)(message);
});

export class Shell {
  log: LogItem[] = [];
  cwd = localStorage.getItem('cwd') || '';
  public fullscreenItem: JoelEvent<LogItem> = new JoelEvent<LogItem>(null);
  public activeItem = new JoelEvent<LogItem>(null);
  public promptLock = new JoelEvent<number>(0);
  public addItemEvent = new JoelEvent<LogItem>(null);
  public clearEvent = new JoelEvent<void>(undefined);
  private _cachedEvaluationResult = new Map<string, Promise<string>>();
  private _connections: JSConnection[] = [];
  private _size = new JoelEvent(size);
  private _cachedGlobalObjectId: string;
  private _cachedGlobalVars: Set<string>|undefined;
  private _cachedSuggestions = new Map<string, Promise<Suggestion[]>>();
  private _connectionToName = new WeakMap<JSConnection, string>();
  private _connectionToDestroy = new WeakMap<JSConnection, (() => void)>();
  private _connectionNameEvent = new JoelEvent<string>('');

  private _connectionNameElement = document.createElement('div');
  private constructor(private _shellId: number) {
    this._connectionNameElement.classList.add('connection-name');
    this._connectionNameEvent.on(name => {
      this._connectionNameElement.textContent = name;
    });
  }

  async _setupConnection(args: string[]) {
    const {socketId} = await window.electronAPI.sendMessage({
      method: 'createJSShell',
      params: {
        cwd: this.cwd,
      }
    });
    this._clearCache();
    const connection = new JSConnection({
      listen: callback => {
        socketListeners.set(socketId, callback);
      },
      send: message => {
        window.electronAPI.notify({method: 'sendMessageToWebSocket', params: {socketId, message}});
      },
      ready: Promise.resolve(),
    });
    const filePath = args[0];
    this._connectionToName.set(connection, filePath);
    const notify = async function(method: string, params: any) {
      await connection.send('Runtime.callFunctionOn', {
        objectId: notifyObjectId,
        functionDeclaration: `function(data) { return this(data); }`,
        arguments: [{
          value: {method, params}
        }]
      });
    }
    connection.on('Runtime.consoleAPICalled', message => {
      // console.timeEnd messages are sent twice
      if (message.stackTrace?.callFrames[0]?.functionName === 'timeLogImpl')
        return;
      this.addItem(new JSLogBlock(message, connection));
    });
    connection.on('Runtime.executionContextDestroyed', message => {
        if (message.executionContextId === 1)
          destroy();
    });
    const terminals = new Map<number, {block: TerminalBlock, cleanup: () => void}>();
    const handler = {
      data: ({data, id}: {data: string, id: number}) => {
        terminals.get(id).block.addData(data);
      },
      endTerminal:async ({id}: {id: number}) => {
        const {block, cleanup} = terminals.get(id);
        terminals.delete(id);
        this.activeItem.dispatch(null);
        this._unlockPrompt();
        await block.close();
        titleThrottle.update('');
        cleanup();
        if (block.cleared && block.empty) {
          block.dispose();
          this.log.splice(this.log.indexOf(block), 1);
          this.clearEvent.dispatch();
        }
      },
      startTerminal:({id}: {id: number}) => {
        const terminalBlock = new TerminalBlock(this._size, async data => {
          await notify('input', { data, id});
        });
        const onFullScreen = (value: boolean) => {
          if (value)
            this.fullscreenItem.dispatch(terminalBlock);
          else if (this.fullscreenItem.current === terminalBlock)
            this.fullscreenItem.dispatch(null);
        };
        const onClear = () => {
          for (const item of this.log) {
            if (item !== terminalBlock)
              item.dispose();
          }
          this.log = [terminalBlock];
          this.clearEvent.dispatch();
        };    
        terminalBlock.fullscreenEvent.on(onFullScreen);
        terminalBlock.clearEvent.on(onClear);
        terminals.set(id, {block: terminalBlock, cleanup: () => {
          terminalBlock.fullscreenEvent.off(onFullScreen);
          terminalBlock.clearEvent.off(onClear);
        }});
        this.addItem(terminalBlock);
        this._lockPrompt();
        this.activeItem.dispatch(terminalBlock);
      },
      cwd: cwd => {
        this.cwd = cwd;
        localStorage.setItem('cwd', cwd);
        window.electronAPI.sendMessage({
          method: 'chdir',
          params: {
            shellId: this._shellId,
            dir: cwd,
          },
        })
      },
      aliases: () => {},
      env: () => {},
      nod: async (args) => {
        this._lockPrompt();
        await this._setupConnection(args);
        this._unlockPrompt();
      }
    }
    connection.on('Runtime.bindingCalled', message => {
      if (message.name !== "magic_binding")
        return;
      const {method, params} = JSON.parse(message.payload);
      handler[method](params);
    });
    await connection.send('Runtime.enable', {});
    await connection.send('Runtime.addBinding', {
      name: 'magic_binding',
    });
    const {result: {objectId: notifyObjectId}} = await connection.send('Runtime.evaluate', {
      expression: `bootstrap(${JSON.stringify(args)})`,
      returnByValue: false,
    });
    const resize = size => notify('resize', size);
    notify('resize', size);
    this._size.on(resize);
    this._connections.push(connection);
    this._connectionNameEvent.dispatch(this._connectionToName.get(connection));
    let destroyed = false;
    const destroy = () => {
      if (destroyed)
        return;
      destroyed = true;
      window.electronAPI.notify({method: 'destroyWebsocket', params: {socketId}});
      for (const id of terminals.keys())
        handler.endTerminal({id});
      this._size.off(resize);
      if (this._connections[this._connections.length - 1] === connection) {
        this._clearCache();
      }
      this._connections.splice(this._connections.indexOf(connection), 1);
      this._connectionNameEvent.dispatch(this._connectionToName.get(this.connection));
    }
    this._connectionToDestroy.set(connection, destroy);

    if (args.length) {
      const file = args[0];
      const result = await connection.send('Runtime.evaluate', {
        expression: `require('fs').readFileSync(${JSON.stringify(file)}, 'utf8')`,
        returnByValue: true,
      });
      await connection.send('Runtime.evaluate', {
        expression: result.result.value,
        replMode: true,
      }).catch(() => {
        // it could exit
        destroy();
      });
    } else {
      const {result, exceptionDetails} = await connection.send('Runtime.evaluate', {
        expression: `require('fs').readFileSync(require('path').join(require('os').homedir(), '.bootstrap.shjs'), 'utf8');`,
        returnByValue: true
      });
      if (!exceptionDetails && result.type === 'string') {
        const expression = await this._transformCode(result.value);
        await connection.send('Runtime.evaluate', {
          expression,
          returnByValue: true,
          generatePreview: false,
          userGesture: false,
          replMode: true,
          allowUnsafeEvalBlockedByCSP: true,
        }).catch(() => {
          // it could exit
          destroy();
        });
      }
    }
  }

  static async create(): Promise<Shell> {
    const {shellId} = await window.electronAPI.sendMessage({
      method: 'createShell',
    });
    const shell = new Shell(shellId);
    shells.set(shellId, shell);
    await shell.updateSize();
    await window.electronAPI.sendMessage({
      method: 'chdir',
      params: {
        shellId,
        dir: shell.cwd,
      },
    });
    await shell._setupConnection([]);
    return shell;
  }

  private get connection() {
    return this._connections[this._connections.length - 1];
  }

  async globalVars(): Promise<Set<string>> {
    if (this._cachedGlobalVars)
      return this._cachedGlobalVars;
    try {
      const {names} = await this.connection.send('Runtime.globalLexicalScopeNames', {});
      const {result} = await this.connection.send('Runtime.getProperties', {
        objectId: await this.globalObjectId(),
        generatePreview: false,
        ownProperties: false,
        accessorPropertiesOnly: false,
      });
      const globalNames = result.filter(x => !x.symbol).map(x => x.name);
      this._cachedGlobalVars = new Set(names.concat(globalNames));
      return this._cachedGlobalVars;
    } catch (e) {
      return new Set();
    }
  }

  async globalObjectId() {
    if (this._cachedGlobalObjectId)
      return this._cachedGlobalObjectId;
    const {result: {objectId}} = await this.connection.send('Runtime.evaluate', {
      expression: '(function() {return this})()',
      returnByValue: false,
    });
    return objectId;
  }

  async _transformCode(code: string) {
    const { transformCode } = await import('../shjs/transform');
    const jsCode = transformCode(code, 'global.pty', await this.globalVars());
    return jsCode;
  }

  async _clearCache() {
    this._cachedEvaluationResult = new Map();
    delete this._cachedGlobalVars;
    this._cachedSuggestions = new Map();
    delete this._cachedGlobalObjectId;
  }

  async runCommand(command: string) {
    const commandBlock = new CommandBlock(command, this._connectionNameEvent.current);
    commandBlock.cachedEvaluationResult = this._cachedEvaluationResult;
    this.addItem(commandBlock);
    if (!command)
      return;
    
    titleThrottle.update(command);
    this._lockPrompt();
    this.activeItem.dispatch(commandBlock);
    const historyId = await this._addToHistory(command);
    const jsCode = await this._transformCode(command);
    let error;
    const connection = this.connection;
    const result = await connection.send('Runtime.evaluate', {
      expression: preprocessForJS(jsCode),
      returnByValue: false,
      generatePreview: true,
      userGesture: true,
      replMode: true,
      allowUnsafeEvalBlockedByCSP: true,
    }).catch(e => {
      error = e;
      return null;
    });
    // thes script could cause the shell to be destroyed
    if (error) {
      this._connectionToDestroy.get(connection)();
      this._unlockPrompt();
      return;
    }
    this._clearCache();
    // TODO update the prompt line here?
    if (historyId) {
      await updateHistory(historyId, 'end', Date.now());
      // TODO need a new history output format that considers terminal and js
      await updateHistory(historyId, 'output', JSON.stringify(result));
    }
    const {exceptionDetails} = result;
    if (exceptionDetails) {
      if (exceptionDetails.stackTrace) {
        const callFrame = exceptionDetails.stackTrace.callFrames[exceptionDetails.stackTrace.callFrames.length - 1];
        commandBlock.addSquiggly({
          start: {
            line: callFrame.lineNumber,
            column: callFrame.columnNumber,
          },
          end: {
            line: callFrame.lineNumber,
            column: Infinity
          }
        }, '#E50000');
      } else {
        commandBlock.addSquiggly({
          start: {
            line: exceptionDetails.lineNumber,
            column: exceptionDetails.columnNumber,
          },
          end: {
            line: exceptionDetails.scriptId ? exceptionDetails.lineNumber : Infinity,
            column: Infinity
          }
        }, '#E50000');
      }
    }
    if (this.activeItem.current === commandBlock)
      this.activeItem.dispatch(null);
    this._unlockPrompt();
    if (result.result?.type === 'string' && result.result.value === 'this is the secret secret string')
      return;
    const jsBlock = new JSBlock(result.exceptionDetails ? result.exceptionDetails.exception : result.result, connection, this._size);

    this.addItem(jsBlock);
  }

  async evaluate(code: string): Promise<string> {
    const result = await window.electronAPI.sendMessage({
      method: 'evaluate',
      params: {
        shellId: this._shellId,
        code,
      },
    });
    return result.trim();
  }

  async updateSize() {
    this._size.dispatch(size);
  }

  async cachedEvaluation(code: string): Promise<string> {
    if (!this._cachedEvaluationResult.has(code))
      this._cachedEvaluationResult.set(code, this.evaluate(code));;
    return this._cachedEvaluationResult.get(code);
  }

  _lockPrompt() {
    this.promptLock.dispatch(this.promptLock.current + 1);
  }

  _unlockPrompt() {
    this.promptLock.dispatch(this.promptLock.current - 1);
  }

  addPrompt(container: Element, willResize: () => void) {
    const element = document.createElement('div');
    element.style.opacity = '0';
    element.classList.add('prompt');
    const editorLine = document.createElement('div');
    editorLine.classList.add('editor-line');
    element.appendChild(editorLine);
    const isReady = new Promise<void>(resolve => {
      editorLine.append(CommandPrefix(this, resolve));
    });
    titleThrottle.update(computePrettyDirName(this));
    Promise.race([isReady, new Promise(x => setTimeout(x, 100))]).then(() => {
      element.style.removeProperty('opacity');
    });
    const editorWrapper = document.createElement('div');
    editorWrapper.style.position = 'relative';
    editorWrapper.style.flex = '1';
    editorWrapper.style.minHeight = '14px';
    editorWrapper.addEventListener('keydown', async event => {
      if (event.key !== 'Enter' || event.shiftKey)
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.ctrlKey && !editor.somethingSelected()) {
        const start = editor.selections[0].start;
        if (start.line !== editor.lastLine) {
          if (start.column === editor.line(start.line).length) {
            willResize();
            editor.smartEnter();
            return;
          }
        } else {
          if (start.column === editor.line(start.line).length) {
            const code = await this._transformCode(editor.text());
            if (isUnexpectedEndOfInput(code)) {
              willResize();
              editor.smartEnter();
              return;
            }
          }
        }
      }
      const command = editor.value;
      editor.selections = [{start: {column: 0, line: 0}, end: {column: 0, line: 0}}];
      editor.value = '';
      this.runCommand(command);
      event.stopPropagation();
      event.preventDefault();
    }, false);
    editorLine.appendChild(editorWrapper);
    const {editor, autocomplete} = makePromptEditor(this);
    editorWrapper.appendChild(editor.element);
    editorLine.appendChild(this._connectionNameElement);
    container.appendChild(element);
    editor.layout();
    editor.focus();

    const belowPrompt = document.createElement('div');
    belowPrompt.classList.add('below-prompt');
    element.appendChild(belowPrompt);
    let lock = {};
    const onChange = async () => {
      const mylock = {};
      lock = mylock;
      const value = autocomplete.valueWithSuggestion();
      const code = preprocessForJS(await this._transformCode(value));
      // throttle a bit
      await new Promise(requestAnimationFrame);
      if (lock !== mylock)
        return;
      if (!code.trim()) {
        belowPrompt.textContent = '';
        return;
      }
      const result = await this.connection.send('Runtime.evaluate', {
        expression: code,
        replMode: true,
        returnByValue: false,
        generatePreview: true,
        userGesture: true,
        allowUnsafeEvalBlockedByCSP: true,
        throwOnSideEffect: /^[\.A-Za-z0-9_\s]*$/.test(code) ? false : true,
        timeout: 1000,
        objectGroup: 'eager-eval',
      });
      if (lock !== mylock)
        return;
      belowPrompt.textContent = '';
      void this.connection.send('Runtime.releaseObjectGroup', {
        objectGroup: 'eager-eval',
      });
      if (result.exceptionDetails)
        return;
      belowPrompt.append(renderRemoteObjectOneLine(result.result, size.cols));
    }
    editor.on('change', onChange);
    autocomplete.suggestionChanged.on(onChange);
    return element;
  }

  async _addToHistory(command: string) {
    if (!command)
      return;
    const [historyId, pwd, home, revName, dirtyState, hash] = await Promise.all([
      addHistory(command),
      this.cachedEvaluation('pwd'),
      this.cachedEvaluation('echo $HOME'),
      this.cachedEvaluation('__git_ref_name'),
      this.cachedEvaluation('__is_git_dirty'),
      this.cachedEvaluation('GIT_OPTIONAL_LOCKS=0 git rev-parse HEAD'),
    ]);
    await Promise.all([
      updateHistory(historyId, 'home', home),
      updateHistory(historyId, 'pwd', pwd),
      updateHistory(historyId, 'git_branch', revName),
      updateHistory(historyId, 'git_dirty', dirtyState),
      updateHistory(historyId, 'git_hash', hash),
    ]);
    return historyId;
  }

  addItem(item: LogItem) {
    this.log.push(item);
    this.addItemEvent.dispatch(item);
  }

  async jsCompletions(prefix: string): Promise<Suggestion[]> {
    if (!this._cachedSuggestions.has(prefix)) {
      const inner = async () => {
        const {exceptionDetails, result} = await this.connection.send('Runtime.evaluate', {
          throwOnSideEffect: true,
          timeout: 1000,
          expression: `Object(${prefix})`,
          replMode: true,
          returnByValue: false,
          generatePreview: false
        });
        if (exceptionDetails || !result.objectId)
          return [];
        const { result: properties } = await this.connection.send('Runtime.getProperties', {
          objectId: result.objectId,
          ownProperties: false,
          generatePreview: false,
        });
        function isPropertyLegal(property: import('./protocol').Protocol.Runtime.PropertyDescriptor) {
          if (property.symbol)
            return false;
          if (!property.name)
            return false;
          if (/\d/.test(property.name[0]))
            return false;
          return /^[A-Za-z\d_]*$/.test(property.name);
        }
        return properties.filter(isPropertyLegal).map(p => ({text: p.name}));
      }
      this._cachedSuggestions.set(prefix, inner());
    }
    return this._cachedSuggestions.get(prefix);
  }
}

function measureChar() {
  const div = document.createElement('div');
  div.style.font = '10px monaco';
  div.style.position = 'absolute';
  div.style.top = '-1000px';
  div.style.left = '-1000px';
  div.style.lineHeight = 'normal';
  div.style.visibility = 'hidden';
  div.textContent = 'W'.repeat(10);
  document.body.appendChild(div);
  const {width, height} = div.getBoundingClientRect();
  div.remove();
  return {width: width/10, height: height};
}

