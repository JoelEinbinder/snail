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
import { suffixThrottle, titleThrottle } from './title';
import { host } from './host';
import { AntiFlicker } from './AntiFlicker';
import { ProgressBlock } from './ProgressBlock';
import { TerminalDataProcessor } from './TerminalDataProcessor';
import { TaskQueue } from './TaskQueue';
import { IFrameBlock } from './IFrameBlock';
import { MenuItem, showContextMenu } from './contextMenu';
import { fontString } from './font';

const shells = new Set<Shell>();
const socketListeners = new Map<number, (message: string) => void>();
const socketCloseListeners = new Map<number, () => void>();

host.onEvent('websocket', ({socketId, message}) => {
  socketListeners.get(socketId)(message);
});
host.onEvent('websocket-closed', ({socketId}) => {
  socketCloseListeners.get(socketId)();
});

interface ShellDelegate {
  onClose(): void;
}

export class Shell {
  log: LogItem[] = [];
  public fullscreenItem: JoelEvent<LogItem> = new JoelEvent<LogItem>(null);
  public activeItem = new JoelEvent<LogItem>(null);
  public promptLock = new JoelEvent<number>(0);
  public addItemEvent = new JoelEvent<LogItem>(null);
  public clearEvent = new JoelEvent<void>(undefined);
  private _cachedEvaluationResult = new Map<string, Promise<string>>();
  private _connections: JSConnection[] = [];
  private _size = new JoelEvent({cols: 0, rows: 0});
  private _cachedGlobalObjectId: string;
  private _cachedGlobalVars: Set<string>|undefined;
  private _cachedSuggestions = new Map<string, Promise<Suggestion[]>>();
  private _connectionToName = new WeakMap<JSConnection, string>();
  private _connectionToDestroy = new WeakMap<JSConnection, (() => void)>();
  private _connectionNameEvent = new JoelEvent<string>('');
  private _connectionToShellId = new WeakMap<JSConnection, number>();
  private _connectionToSSHAddress = new WeakMap<JSConnection, string>();
  private _antiFlicker = new AntiFlicker(() => this._lockPrompt(), () => this._unlockPrompt());
  private _delegate?: ShellDelegate;
  private _connectionNameElement = document.createElement('div');
  private _connectionIsDaemon = new WeakMap<JSConnection, boolean>();
  private constructor() {
    this._connectionNameElement.classList.add('connection-name');
    this._connectionNameEvent.on(name => {
      this._connectionNameElement.textContent = name;
    });
  }

  setDelegate(delegate: ShellDelegate) {
    this._delegate = delegate;
  }

  get cwd() {
    return this.connection?.cwd || '';
  }

  get env() {
    return this.connection?.env || {};
  }

  async _setupConnection(args: string[], sshAddress = null, socketPath = null) {
    const [{shellId}, {socketId}] = await Promise.all([
      host.sendMessage({
        method: 'createShell',
        params: {
          sshAddress,
        }
      }),
      host.sendMessage({
        method: 'createJSShell',
        params: {
          cwd: this.connection ? this.connection.cwd : localStorage.getItem('cwd') || '',
          socketPath,
          sshAddress,
        }
      })
    ] as const);
    this._clearCache();
    const connection = new JSConnection({
      listen: callback => {
        socketListeners.set(socketId, callback);
      },
      send: message => {
        host.notify({method: 'sendMessageToWebSocket', params: {socketId, message}});
      },
    });
    this._connectionIsDaemon.set(connection, false);
    connection.on('Shell.daemonStatus', ({isDaemon}) => {
      this._connectionIsDaemon.set(connection, isDaemon);
      this._updateSuffix();
    });
    await connection.send('Shell.enable', undefined);
    socketCloseListeners.set(socketId, () => {
      connection.didClose();
      socketListeners.delete(socketId);
      socketCloseListeners.delete(socketId);
    });
    this._connectionToShellId.set(connection, shellId);
    this._connectionToSSHAddress.set(connection, sshAddress);
    const filePath = args[0];
    this._connectionToName.set(connection, filePath || sshAddress);
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
      this.addItem(new JSLogBlock(message, connection, this._size));
    });
    connection.on('Runtime.executionContextDestroyed', message => {
        if (message.executionContextId === 1)
          destroy();
    });
    const terminals = new Map<number, {processor: TerminalDataProcessor, cleanup: () => Promise<void>}>();
    const handler = {
      data: ({data, id}: {data: string, id: number}) => {
        terminals.get(id).processor.processRawData(data);
      },
      endTerminal:async ({id}: {id: number}) => {
        const {cleanup} = terminals.get(id);
        terminals.delete(id);
        this.activeItem.dispatch(null);
        await cleanup();
        this._unlockPrompt();
        titleThrottle.update('');
      },
      startTerminal:({id}: {id: number}) => {
        const progressBlock = new ProgressBlock();
        this.addItem(progressBlock);
        this._lockPrompt();
        let activeTerminalBlock: TerminalBlock = null;
        let activeIframeBlock: IFrameBlock = null;
        const terminalTaskQueue = new TaskQueue();
        const processor = new TerminalDataProcessor({
          htmlTerminalMessage: data => {
            switch(data[0]) {
              case 75:
                // legacy unimplemented
                // lets try to do everything the new way
                break;
              case 76: {
                // normal
                terminalTaskQueue.queue(async () => {
                  await closeActiveTerminalBlock();
                  if (activeIframeBlock) {
                    activeIframeBlock.didClose();
                    activeIframeBlock = null;
                  }
                  const dataStr = new TextDecoder().decode(data.slice(1));
                  const iframeBlock = new IFrameBlock(dataStr, {
                    async sendInput(data) {
                        await notify('input', { data, id});
                    },
                    shellId,
                    antiFlicker: this._antiFlicker,
                  });
                  activeIframeBlock = iframeBlock;
                  this.addItem(iframeBlock);
                  this.activeItem.dispatch(iframeBlock);
                });
                break;
              }
              case 77:
                // message
                terminalTaskQueue.queue(async () => {
                  const dataStr = new TextDecoder().decode(data.slice(1));
                  if (!activeIframeBlock) {
                    console.error('parse error, sending message without iframe');
                    return;
                  }
                  activeIframeBlock.message(dataStr);
                });
                break;
              case 78:
                // progress
                const dataStr = new TextDecoder().decode(data.slice(1));
                progressBlock.setProgress(JSON.parse(dataStr));
                break;
              case 79:
                // end
                terminalTaskQueue.queue(async () => {
                  if (activeIframeBlock) {
                    activeIframeBlock.didClose();
                    activeIframeBlock = null;
                  }
                  if (!activeTerminalBlock)
                    await addTerminalBlock();
                });
                break;
              }
          },
          plainTerminalData: data => {
            terminalTaskQueue.queue(async () => {
              if (!activeTerminalBlock)
                await addTerminalBlock();
              activeTerminalBlock.addData(data);
            })
          },
        });
        terminals.set(id, {
          processor,
          cleanup: async () => {
            await terminalTaskQueue.queue(() => {
              if (activeIframeBlock)
                activeIframeBlock.didClose();
              progressBlock.deactivate();
              return closeActiveTerminalBlock();
            });
        }});
        const closeActiveTerminalBlock = async () => {
          if (!activeTerminalBlock)
            return;
          await activeTerminalBlock.close();
          if (activeTerminalBlock.cleared && activeTerminalBlock.empty) {
            activeTerminalBlock.dispose();
            this.log.splice(this.log.indexOf(activeTerminalBlock), 1);
            this.clearEvent.dispatch();
          }
          activeTerminalBlock = null;
        }
        const addTerminalBlock = async () => {
          await closeActiveTerminalBlock();
          const terminalBlock = new TerminalBlock({
            async sendInput(data) {
                await notify('input', { data, id});
            },
            shellId,
            size: this._size,
            antiFlicker: this._antiFlicker,
          });
          activeTerminalBlock = terminalBlock;
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
          this.addItem(terminalBlock);
          this.activeItem.dispatch(terminalBlock);
        };
        terminalTaskQueue.queue(() => addTerminalBlock());
      },
      cwd: cwd => {
        connection.cwd = cwd;
        if (this._connections[0] === connection)
          localStorage.setItem('cwd', cwd);
        host.sendMessage({
          method: 'chdir',
          params: {
            shellId,
            dir: cwd,
          },
        });
      },
      aliases: (aliases) => {
        host.sendMessage({
          method: 'aliases',
          params: {
            shellId,
            aliases,
          },
        });
      },
      env: (env: {[key: string]: string}) => {
        for (const [key, value] of Object.entries(env))
          connection.env[key] = value;
        host.sendMessage({
          method: 'env',
          params: {
            shellId,
            env,
          },
        });
      },
      nod: async (args: string[]) => {
        this._lockPrompt();
        await this._setupConnection(args);
        this._unlockPrompt();
      },
      ssh: async (sshAddress: string) => {
        this._lockPrompt();
        await this._setupConnection([], sshAddress);
        this._unlockPrompt();
      },
      reconnect: async (sockePath: string) => {
        this._lockPrompt();
        await this._setupConnection([], undefined, sockePath);
        this._unlockPrompt();
      },
      code: async (file: string) => {
        let code;
        if (sshAddress)
          code = `code --remote 'ssh-remote+${sshAddress}' '${file}'`;
        else
          code = `code '${file}'`;
        await host.sendMessage({
          method: 'evaluate',
          params: {
            shellId: this._connectionToShellId.get(this._connections[0]),
            code,
          },
        });
      },
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
    notify('resize', this._size.current);
    this._size.on(resize);
    this._connections.push(connection);
    this._updateSuffix();
    this._connectionNameEvent.dispatch(this._connectionToName.get(connection));
    let destroyed = false;
    const destroy = () => {
      if (destroyed)
        return;
      destroyed = true;
      host.notify({method: 'destroyWebsocket', params: {socketId}});
      for (const id of terminals.keys())
        handler.endTerminal({id});
      this._size.off(resize);
      if (this._connections[this._connections.length - 1] === connection) {
        this._clearCache();
      }
      this._connections.splice(this._connections.indexOf(connection), 1);
      this._updateSuffix();
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
    {
      const {result, exceptionDetails} = await connection.send('Runtime.evaluate', {
        expression: `({env: {...process.env}, cwd: process.cwd()})`,
        returnByValue: true
      });
      connection.env = result.value.env;
      connection.cwd = result.value.cwd;
    }

  }

  static async create(sshAddress?: string): Promise<Shell> {
    console.time('create shell');
    const shell = new Shell();
    shells.add(shell);
    await shell._setupConnection([], sshAddress);
    await host.sendMessage({
      method: 'chdir',
      params: {
        shellId: shell._connectionToShellId.get(shell.connection),
        dir: shell.cwd,
      },
    });
    console.timeEnd('create shell');
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

  _clearCache() {
    this._cachedEvaluationResult = new Map();
    delete this._cachedGlobalVars;
    this._cachedSuggestions = new Map();
    delete this._cachedGlobalObjectId;
  }

  async toggleDaemon() {
    await this.connection.send('Shell.setIsDaemon', {
      isDaemon: !this._connectionIsDaemon.get(this.connection),
    });
  }

  _updateSuffix() {
    suffixThrottle.update(this._connectionIsDaemon.get(this.connection) ? ' 😈' : '');
  }

  async runCommand(command: string) {
    const commandBlock = new CommandBlock(command, this._connectionNameEvent.current, {...this.env}, this.cwd, this._cachedGlobalVars, this.sshAddress);
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
      if (this._connections.length === 0) {
        this._delegate?.onClose();
        return;
      }
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
    if (result.result?.type === 'string' && result.result.value.startsWith('this is the secret secret string:')) {
      commandBlock.setExitCode(parseInt(result.result.value.substring('this is the secret secret string:'.length)));
      return;
    }
    const jsBlock = new JSBlock(result.exceptionDetails ? result.exceptionDetails.exception : result.result, connection, this._size);

    this.addItem(jsBlock);
  }

  async evaluate(code: string): Promise<string> {
    const result = await host.sendMessage({
      method: 'evaluate',
      params: {
        shellId: this._connectionToShellId.get(this.connection),
        code,
      },
    });
    return result.trim();
  }

  updateSize(width: number, height: number) {
    const char = measureChar();
    const PADDING = 4;
    const padding = PADDING / window.devicePixelRatio;
    const cols = Math.floor((width - padding * 2) / char.width);
    const rows = Math.floor((window.devicePixelRatio * (height - padding * 2)) / Math.ceil(char.height * window.devicePixelRatio));
  
    this._size.dispatch({cols, rows});
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

  get sshAddress() {
    return this._connectionToSSHAddress.get(this.connection);
  }

  addPrompt(container: Element, willResize: () => void) {
    const element = document.createElement('div');
    element.tabIndex = -1;
    element.style.opacity = '0';
    element.classList.add('prompt');
    const editorLine = document.createElement('div');
    editorLine.classList.add('editor-line');
    element.appendChild(editorLine);
    const commandPrefix = new CommandPrefix(this, async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const recentCwd = this.connection.getRecentCwd();
      if (recentCwd.length < 6) {
        const rows: {pwd: string}[] = await host.sendMessage({
          method: 'queryDatabase',
          params: {
            sql: `SELECT DISTINCT pwd FROM history WHERE ${this.sshAddress ? 'hostname = ?' : 'hostname IS NULL'} AND pwd IS NOT NULL ORDER BY command_id DESC LIMIT 6`,
            params: this.sshAddress ? [this.sshAddress] : undefined,
          }
        });
        for (const row of rows) {
          if (recentCwd.includes(row.pwd))
            continue;
          recentCwd.push(row.pwd);
          if (recentCwd.length >= 6)
            break;
        }
      }
      
      const currentPwd = await this.cachedEvaluation('pwd');
      const items: MenuItem[] = [];
      const currentBranch = await this.cachedEvaluation('__git_ref_name');
      for (const pwd of recentCwd) {
        items.push({
          title: computePrettyDirName(this, pwd),
          checked: pwd === currentPwd,
          callback: currentPwd === pwd ? () => {} : async () => {
            await this.connection.send('Runtime.evaluate', {
              expression: `process.chdir(${JSON.stringify(pwd)})`,
              returnByValue: true,
            });
            this._clearCache();
            commandPrefix.render();
          }
        });
      }
      if (currentBranch) {
        const branches = (await this.cachedEvaluation(`git for-each-ref --sort=-committerdate refs/heads/ '--format=%(refname:short)'`)).split('\n').filter(x => x);
        items.push({});
        items.push({
          title: 'Switch Branch',
          submenu: branches.map(branch => {
            return {
              title: branch,
              checked: branch === currentBranch,
              callback: currentBranch === branch ? () => {} : async () => {
                const evaluated = await this.evaluate(`git checkout ${JSON.stringify(branch)} || echo "could not checkout"`);
                if (evaluated.trim() === 'could not checkout')
                  alert(`Could not checkout the branch ${JSON.stringify(branch)}.\n\nYou may need to commit or stash your changes first.`);
                this._clearCache();
                commandPrefix.render();
              }
            };
          })
        });
      }
      await showContextMenu(items);
    });
    editorLine.append(commandPrefix.element);
    
    const prettyName = computePrettyDirName(this, this.cwd);
    const title =  [this._connectionToName.get(this.connection), prettyName].filter(Boolean).join(' ');
    titleThrottle.update(title);
    Promise.race([commandPrefix.render(), new Promise(x => setTimeout(x, 100))]).then(() => {
      element.style.removeProperty('opacity');
    });
    const editorWrapper = document.createElement('div');
    editorWrapper.style.position = 'relative';
    editorWrapper.style.flex = '1';
    editorWrapper.style.minHeight = '1.4em';
    editorWrapper.addEventListener('keydown', async event => {
      if ((event.key === 'Enter' && !event.shiftKey) || (event.code === 'KeyM' && event.ctrlKey)) {
        event.preventDefault();
        event.stopImmediatePropagation();
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
      } else if (event.code === 'KeyL' && event.ctrlKey) {
        for (const item of this.log) {
            item.dispose();
        }
        this.log = [];
        this.clearEvent.dispatch();
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (event.code === 'KeyC' && event.ctrlKey) {
        const commandBlock = new CommandBlock(editor.value, this._connectionNameEvent.current, {...this.env}, this.cwd, this._cachedGlobalVars, this.sshAddress);
        commandBlock.cachedEvaluationResult = this._cachedEvaluationResult;
        commandBlock.wasCanceled = true;
        this.addItem(commandBlock);
        editor.value = '';
        editor.selections = [{start: {column: 0, line: 0}, end: {column: 0, line: 0}}];

        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, false);
    editorLine.appendChild(editorWrapper);
    const {editor, autocomplete} = makePromptEditor(this);
    editorWrapper.appendChild(editor.element);
    editorLine.appendChild(this._connectionNameElement);
    container.appendChild(element);
    editor.layout();
    editor.focus();
    element.onfocus = () => editor.focus();

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
      belowPrompt.append(renderRemoteObjectOneLine(result.result, this._size.current.cols));
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
      this.sshAddress && updateHistory(historyId, 'hostname', this.sshAddress),
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
  div.style.font = fontString();
  div.style.position = 'absolute';
  div.style.top = '-1000px';
  div.style.left = '-1000px';
  div.style.lineHeight = 'normal';
  div.style.visibility = 'hidden';
  div.textContent = 'W'.repeat(10);
  document.body.appendChild(div);
  const {width, height} = div.getBoundingClientRect();
  div.remove();
  return {width: Math.floor(window.devicePixelRatio * width/10) / window.devicePixelRatio, height: Math.ceil(height)};
}

