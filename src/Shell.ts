import 'xterm/css/xterm.css';
import { addHistory, updateHistory } from './history';
import { makePromptEditor } from './PromptEditor';
import { JoelEvent } from '../slug/cdp-ui/JoelEvent';
import type { LogItem } from './LogView';
import { CommandBlock, CommandPrefix, computePrettyDirName } from './CommandBlock';
import { TerminalBlock } from './TerminalBlock';
import { ExtraClientMethods, JSConnection } from './JSConnection';
import { JSBlock, JSLogBlock, renderRemoteObjectOneLine } from '../slug/cdp-ui/JSBlock';
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
import { Protocol } from './protocol';
import { cdpManager } from './CDPManager';
import { randomUUID } from './uuid';
import { startAyncWork } from './async';
import { AskPasswordBlock } from './AskPasswordBlock';

const socketListeners = new Map<number, (message: {method: string, params: any}|{id: number, result: any}) => void>();
const socketCloseListeners = new Map<number, () => void>();

host.onEvent('websocket', ({socketId, message}) => {
  socketListeners.get(socketId)(message);
});
host.onEvent('websocket-closed', ({socketId}) => {
  socketCloseListeners.get(socketId)();
});

export interface ShellDelegate {
  shellClosed(): void;
  addItem(item: LogItem): void;
  removeItem(item: LogItem): void;
  clearAllExcept(item: LogItem): void;
  clearAll(): void;
  togglePrompt(showPrompt: boolean): void;
  setActiveItem(item: LogItem|null): void;
  setFullscreenItem(item: LogItem|null): void;
}

interface ConnectionCore {
  send(message: {method: string, params: any, id: number}): void;
  onmessage?: (message: {method: string, params: any}|{id: number, result: any}) => void;
  onclose?: () => void;
  destroy(): void;
  initialize(): Promise<void>;
  urlForIframe(filePath: string, shellIds: number[]): Promise<string>;
  readonly isRestoration: boolean;
}

export class Shell {
  private _fullscreenItem: JoelEvent<LogItem> = new JoelEvent<LogItem>(null);
  private _activeItem = new JoelEvent<LogItem>(null);
  private _cachedEvaluationResult = new Map<string, Promise<string>>();
  private _connections: JSConnection[] = [];
  private _size = new JoelEvent({cols: 80, rows: 24});
  private _cachedGlobalObjectId: string;
  private _cachedGlobalVars: Set<string>|undefined;
  private _cachedSuggestions = new Map<string, Promise<Suggestion[]>>();
  private _connectionToName = new WeakMap<JSConnection, string>();
  private _connectionToDestroy = new WeakMap<JSConnection, (() => void)>();
  private _connectionNameEvent = new JoelEvent<string>('');
  private _connectionToSSHAddress = new WeakMap<JSConnection, string>();
  private _antiFlicker = new AntiFlicker(() => this._lockPrompt('AntiFlicker'), unlockPrompt => unlockPrompt());
  private _promptLocks = new Set<{ name?: string }>();
  private _connectionNameElement = document.createElement('div');
  private _connectionIsDaemon = new WeakMap<JSConnection, boolean>();
  private _refreshActiveIframe?: () => void;
  //@ts-ignore
  private _uuid: string = randomUUID();
  private _setupUnlock: () => void;
  constructor(private _delegate: ShellDelegate) {
    console.time('create shell');
    this._setupUnlock = this._lockPrompt('setupInitialConnection');
    this._connectionNameElement.classList.add('connection-name');
    this._connectionNameEvent.on(name => {
      this._connectionNameElement.textContent = name;
    });
    this._fullscreenItem.on(item => this._delegate.setFullscreenItem(item));
    this._activeItem.on(item => this._delegate.setActiveItem(item));
    this._delegate.togglePrompt(!this._promptLocks.size);
  }

  get cwd() {
    return this.connection?.cwd || '';
  }

  get env() {
    return this.connection?.env || {};
  }

  async _setupConnection(args: string[]) {
    const socketId = await host.sendMessage({ method: 'obtainWebSocketId' });

    socketCloseListeners.set(socketId, () => {
      core.onclose?.();
      socketListeners.delete(socketId);
      socketCloseListeners.delete(socketId);
    });
    const core: ConnectionCore = {
      send(message) {
        host.notify({method: 'sendMessageToWebSocket', params: {socketId, message}});
      },
      destroy() {
        host.notify({method: 'destroyWebsocket', params: {socketId}});
      },
      urlForIframe(filePath, shellIds) {
        return host.sendMessage({
          method: 'urlForIFrame',
          params: {
            shellIds: [socketId, ...shellIds],
            filePath,
          }
        })
      },
      initialize: async () => {
        await host.sendMessage({
          method: 'createJSShell',
          params: {
            // cwd comes from the top level because it has to match the host.
            // TODO get this directly form the host?
            cwd: this._connections[0] ? this._connections[0].cwd : localStorage.getItem('cwd') || '',
            socketId,
          }
        });
      },
      isRestoration: false,
    }
    socketListeners.set(socketId, message => core.onmessage?.(message));
    return this._setupConnectionInner(core, args);
  }
  async _setupConnectionInner(core: ConnectionCore, args: string[], sshAddress = null) {
    this._clearCache();
    const connection = new JSConnection(core);
    core.onclose = () => connection.didClose();
    this._connectionIsDaemon.set(connection, false);
    connection.on('Shell.daemonStatus', ({isDaemon}) => {
      this._connectionIsDaemon.set(connection, isDaemon);
      this._updateSuffix();
    });
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
    connection.on('Shell.askPassword', ({ id, message}) => {
      const item = new AskPasswordBlock(message, password => {
        connection.send('Shell.providePassword', { id, password });
      });
      this.addItem(item);
      this._activeItem.dispatch(item);
    });
    connection.on('Runtime.executionContextDestroyed', message => {
        if (message.executionContextId === 1)
          destroy();
    });
    const terminals = new Map<number, {processor: TerminalDataProcessor, cleanup: () => Promise<void>}>();
    const handler = {
      data: ({data, id}: {data: string, id: number}) => {
        // we might have lost the terminal creation due to data smooshing
        // make it anyway to be nice
        // TODO check if it has already ended?
        if (!terminals.has(id))
          handler.startTerminal({id});
        terminals.get(id).processor.processRawData(data);
      },
      endTerminal:async ({id}: {id: number}) => {
        const {cleanup} = terminals.get(id);
        terminals.delete(id);
        this._activeItem.dispatch(null);
        await cleanup();
        titleThrottle.update('');
      },
      startTerminal:({id}: {id: number}) => {
        const progressBlock = new ProgressBlock();
        this.addItem(progressBlock);
        const unlockPrompt = this._lockPrompt('startTerminal');
        let activeTerminalBlock: TerminalBlock = null;
        let activeIframeBlock: IFrameBlock = null;
        this._refreshActiveIframe = () => {
          activeIframeBlock?.refresh();
        };
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
                  let dataObj: {entry: string, browserView?: boolean};
                  try {
                  if (dataStr.startsWith('{'))
                    dataObj = JSON.parse(dataStr)
                  else
                    dataObj = {entry: dataStr};
                  }
                  catch { }
                  if (!dataObj)
                    dataObj = { entry: 'uh-oh-invalid-parse-entry???!!!' };
                  const iframeBlock = new IFrameBlock(String(dataObj.entry), {
                    async sendInput(data) {
                        await notify('input', { data, id});
                    },
                    connection,
                    urlForIframe: filePath => core.urlForIframe(filePath, []),
                    antiFlicker: this._antiFlicker,
                    browserView: !!(dataObj.browserView),
                  });
                  activeIframeBlock = iframeBlock;
                  this.addItem(iframeBlock);
                  this._activeItem.dispatch(iframeBlock);
                  cdpManager.setDebuggingInfoForTarget(this._uuid, iframeBlock.debugginInfo());
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
              case 80: {
                // thread stdin
                const dataStr = new TextDecoder().decode(data.slice(1));
                // this should only be a uuid. dont notify otherwise in case its some kind of strange injection attempt
                if (!/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/.test(dataStr))
                  break;
                notify('input', { data: dataStr, id});
                break;
              }
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
            await terminalTaskQueue.queue(async () => {
              if (activeIframeBlock)
                activeIframeBlock.didClose();
              progressBlock.deactivate();
              await closeActiveTerminalBlock();
              unlockPrompt();
            });
        }});
        const closeActiveTerminalBlock = async () => {
          if (!activeTerminalBlock)
            return;
          await activeTerminalBlock.close();
          if (activeTerminalBlock.cleared && activeTerminalBlock.empty)
            this._delegate.removeItem(activeTerminalBlock);
          activeTerminalBlock = null;
        }
        const addTerminalBlock = async () => {
          await closeActiveTerminalBlock();
          const terminalBlock = new TerminalBlock({
            async sendInput(data) {
                await notify('input', { data, id});
            },
            size: this._size,
            antiFlicker: this._antiFlicker,
          });
          activeTerminalBlock = terminalBlock;
          const onFullScreen = (value: boolean) => {
            if (value)
              this._fullscreenItem.dispatch(terminalBlock);
            else if (this._fullscreenItem.current === terminalBlock)
              this._fullscreenItem.dispatch(null);
          };
          const onClear = () => {
            this._delegate.clearAllExcept(terminalBlock);
          };    
          terminalBlock.fullscreenEvent.on(onFullScreen);
          terminalBlock.clearEvent.on(onClear);
          this.addItem(terminalBlock);
          this._activeItem.dispatch(terminalBlock);
        };
        terminalTaskQueue.queue(() => addTerminalBlock());
      },
      aliases: (aliases) => {
      },
      env: (env: {[key: string]: string}) => {
        for (const [key, value] of Object.entries(env))
          connection.env[key] = value;
      },
      nod: async (args: string[]) => {
        const done = startAyncWork('nod');
        const unlockPrompt = this._lockPrompt('nod');
        // TODO switch to Shell.createNodSubshell
        await this._setupConnection(args);
        unlockPrompt();
        done();
      },
      ssh: async ({sshAddress, sshArgs, env}: {sshAddress: string, sshArgs: string[], env: Record<string, string>}) => {
        const done = startAyncWork('ssh');
        const unlockPrompt = this._lockPrompt('ssh');
        const sshCore = await this._createSubshell(connection, core, { sshAddress, sshArgs, env })
        // Setting up ssh may have failed or been canceled
        if (sshCore)
          await this._setupConnectionInner(sshCore, [], sshAddress);
        unlockPrompt();
        done();
      },
      reconnect: async (socketPath: string) => {
        const done = startAyncWork('reconnect');
        const unlockPrompt = this._lockPrompt('reconnect');
        const reconnectCore = await this._createSubshell(connection, core, { socketPath });
        await this._setupConnectionInner(reconnectCore, [], this._connectionToSSHAddress.get(connection));
        unlockPrompt();
        done();
      },
      code: async (file: string) => {
        let code;
        if (sshAddress)
          code = `code --remote 'ssh-remote+${sshAddress}' '${file}'`;
        else
          code = `code '${file}'`;
        // TODO this should be a host method
        await this._connections[0].send('Shell.evaluate', {
          code
        });
      },
    }
    connection.on('Shell.cwdChanged', message => {
      connection.cwd = message.cwd;
      if (this._connections[0] === connection)
        localStorage.setItem('cwd', message.cwd);
    });
    connection.on('Shell.notify', message => {
      const {method, params} = message.payload;
      handler[method](params);
    })
    this._connections.push(connection);
    this._updateSuffix();
    this._connectionNameEvent.dispatch(this._connectionToName.get(connection));
    let destroyed = false;
    const destroy = () => {
      if (destroyed)
        return;
      destroyed = true;
      core.destroy();
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
    await core.initialize();
    const {objectId: notifyObjectId} = await connection.send('Shell.enable', {
      args
    });
    const resize = size => notify('resize', size);
    this._size.on(resize);
    notify('resize', this._size.current);

    {
      const {result, exceptionDetails} = await connection.send('Runtime.evaluate', {
        expression: `({env: {...process.env}, cwd: process.cwd()})`,
        returnByValue: true
      });
      connection.env = result.value.env;
      connection.cwd = result.value.cwd;
    }
    if (core.isRestoration) {
      const result = await connection.send('Shell.restore', undefined);
      if (result)
        this._addJSBlock(result, connection);
    }
  }

  async _createSubshell(connection: JSConnection, core: ConnectionCore, params: Parameters<ExtraClientMethods['Shell.createSubshell']>[0]): Promise<ConnectionCore|null> {
    const subshellResult = await connection.send('Shell.createSubshell', params);
    // Setting up ssh may have failed or been canceled
    if ('exitCode' in subshellResult)
      return null;
    const { id } = subshellResult;
    const subCore: ConnectionCore = {
      destroy: () => {
        connection.send('Shell.destroySubshell', { id });
        cleanup();
      },
      isRestoration: !!params['socketPath'],
      send: message => {
        connection.send('Shell.sendMessageToSubshell', { id, message });
      },
      urlForIframe: async (filePath, shellIds) => {
        return core.urlForIframe(filePath, [id, ...shellIds]);
      },
      async initialize() {
        // nothing to do here, because we already made the subshell.
        // TODO should create the subshell here after getting the id above
        // stderr from createSubshell should appear in the inner connection
        // Does that make sense though? Not really because its clearly part of the
        // outer connection output. Consider "echo foo && ssh2 invalidremote"
        // The foo and error from invalidremote should be part of the same connection log
      }
    };
    // TODO maybe it would be nicer to have a single listener for this
    const onSubshellMessage = payload => {
      if (payload.id === id)
        subCore.onmessage?.(payload.message);
    };
    const onSubshellDestroyed = payload => {
      if (payload.id === id)
        cleanup();
    };
    const cleanup = () => {
      connection.off('Shell.messageFromSubshell', onSubshellMessage);
      connection.off('Shell.subshellDestroyed', onSubshellDestroyed);
      subCore.onclose?.();
    };
    connection.on('Shell.messageFromSubshell', onSubshellMessage);
    connection.on('Shell.subshellDestroyed', onSubshellDestroyed);
    return subCore;
  }

  async setupInitialConnection() {
    if (this.connection)
      throw new Error('already has a connection');
    await this._setupConnection([]);
    console.timeEnd('create shell');
    this._setupUnlock(); // prompt starts locked
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
    const { transformCode } = await import('../slug/shjs/transform');
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

  refreshActiveIframe() {
    this._refreshActiveIframe?.();
  }

  _updateSuffix() {
    suffixThrottle.update(this._connectionIsDaemon.get(this.connection) ? ' 😈' : '');
  }

  async runCommand(command: string) {
    const commandBlock = new CommandBlock(command, this._size, this._connectionNameEvent.current, {...this.env}, this.cwd, this._cachedGlobalVars, this.sshAddress);
    commandBlock.cachedEvaluationResult = this._cachedEvaluationResult;
    this.addItem(commandBlock);
    if (!command)
      return;
    
    titleThrottle.update(command);
    const unlockPrompt = this._lockPrompt('runCommand');
    this._activeItem.dispatch(commandBlock);
    const historyId = await this._addToHistory(command);
    const jsCode = await this._transformCode(command);
    let error;
    const connection = this.connection;
    const result = await connection.send('Shell.runCommand', {
      expression: preprocessForJS(jsCode),
      command,
    }).catch(e => {
      error = e;
      return null;
    });
    // thes script could cause the shell to be destroyed
    if (error) {
      this._connectionToDestroy.get(connection)();
      if (this._connections.length === 0) {
        this._delegate.shellClosed();
        cdpManager.removeDebuggingInfoForTarget(this._uuid);
        return;
      }
      unlockPrompt();
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
    if (this._activeItem.current === commandBlock)
      this._activeItem.dispatch(null);
    unlockPrompt();
    this._addJSBlock(result, connection, commandBlock);
  }

  _addJSBlock(result: Protocol.CommandReturnValues['Runtime.evaluate'], connection: JSConnection, commandBlock?: CommandBlock) {
    if (result.result?.type === 'string' && result.result.value.startsWith('this is the secret secret string:')) {
      commandBlock?.setExitCode(parseInt(result.result.value.substring('this is the secret secret string:'.length)));
      return;
    }
    const jsBlock = new JSBlock(result.exceptionDetails ? result.exceptionDetails.exception : result.result, connection, this._size);

    this.addItem(jsBlock);
  }

  async evaluate(code: string): Promise<string> {
    const {result} = await this.connection.send('Shell.evaluate', {
      code,
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

  _lockPrompt(name?: string) {
    const lock = { name };
    this._promptLocks.add(lock);
    if (this._promptLocks.size === 1)
      this._delegate.togglePrompt(false);
    return () => {
      this._promptLocks.delete(lock);
      if (!this._promptLocks.size)
        this._delegate.togglePrompt(true);
    };
  }

  get sshAddress() {
    return this._connectionToSSHAddress.get(this.connection);
  }

  addPrompt(container: Element): LogItem {
    const element = document.createElement('div');
    element.tabIndex = -1;
    element.style.opacity = '0';
    element.classList.add('prompt');
    const editorLine = document.createElement('div');
    editorLine.classList.add('editor-line');
    element.appendChild(editorLine);
    const commandPrefix = new CommandPrefix(this, this._size, async event => {
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
      const finishWork = startAyncWork('User Evaluation');
      if ((event.key === 'Enter' && !event.shiftKey) || (event.code === 'KeyM' && event.ctrlKey)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.ctrlKey && !editor.somethingSelected()) {
          const start = editor.selections[0].start;
          if (start.line !== editor.lastLine) {
            if (start.column === editor.line(start.line).length) {
              editor.smartEnter();
              return;
            }
          } else {
            if (start.column === editor.line(start.line).length) {
              const code = await this._transformCode(editor.text());
              if (isUnexpectedEndOfInput(code)) {
                editor.smartEnter();
                finishWork();
                return;
              }
            }
          }
        }
        const command = editor.value;
        editor.selections = [{start: {column: 0, line: 0}, end: {column: 0, line: 0}}];
        editor.value = '';
        await this.runCommand(command);
      } else if (event.code === 'KeyL' && event.ctrlKey) {
        this._delegate.clearAll();
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (event.code === 'KeyC' && event.ctrlKey) {
        const commandBlock = new CommandBlock(editor.value, this._size, this._connectionNameEvent.current, {...this.env}, this.cwd, this._cachedGlobalVars, this.sshAddress);
        commandBlock.cachedEvaluationResult = this._cachedEvaluationResult;
        commandBlock.wasCanceled = true;
        this.addItem(commandBlock);
        editor.value = '';
        editor.selections = [{start: {column: 0, line: 0}, end: {column: 0, line: 0}}];

        event.preventDefault();
        event.stopImmediatePropagation();
      }
      finishWork();
    }, false);
    editorLine.appendChild(editorWrapper);
    const {editor, autocomplete} = makePromptEditor(this);
    editorWrapper.appendChild(editor.element);
    editorLine.appendChild(this._connectionNameElement);
    container.appendChild(element);
    editor.layout();
    editor.focus();
    host.notify({ method: 'focusMainContent' });
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
        willResizeEvent.dispatch();
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
      willResizeEvent.dispatch();
      belowPrompt.textContent = '';
      void this.connection.send('Runtime.releaseObjectGroup', {
        objectGroup: 'eager-eval',
      });
      if (result.exceptionDetails)
        return;
      belowPrompt.append(renderRemoteObjectOneLine(result.result, this._size.current.cols));
    }
    const willResizeEvent = new JoelEvent<void>(undefined);
    editor.on('change', onChange);
    editor.on('might-resize', () => {
      willResizeEvent.dispatch()
    });
    autocomplete.suggestionChanged.on(onChange);
    return {
      render: () => element,
      dispose: () => {
        commandPrefix.dispose();
        element.remove();
      },
      focus: () => editor.focus(),
      willResizeEvent,
      serializeForTest: async () => {
        const serialized = { value: editor.value } as any;
        const auto = await autocomplete.serializeForTest();
        if (auto)
          serialized.autocomplete = auto;
        return serialized;
      },
    }
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
    this._delegate.addItem(item);
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

