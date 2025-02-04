import 'xterm/css/xterm.css';
import { History } from './history';
import { makePromptEditor } from './PromptEditor';
import { JoelEvent } from '../slug/cdp-ui/JoelEvent';
import type { LLMMessage, LogItem } from './LogItem';
import { CommandBlock, CommandPrefix, computePrettyDirName } from './CommandBlock';
import { TerminalBlock } from './TerminalBlock';
import { ExtraClientMethods, JSConnection } from './JSConnection';
import { JSBlock, JSLogBlock, renderRemoteObjectOneLine } from '../slug/cdp-ui/JSBlock';
import { preprocessForJS, isUnexpectedEndOfInput } from './PreprocessForJS';
import type { Suggestion } from './autocomplete';
import { host } from './host';
import { AntiFlicker } from './AntiFlicker';
import { ProgressBlock } from './ProgressBlock';
import { TerminalDataProcessor } from '../slug/shell/TerminalDataProcessor';
import { TaskQueue } from './TaskQueue';
import { IFrameBlock } from './IFrameBlock';
import { MenuItem, showContextMenu } from './contextMenu';
import { fontString } from './font';
import { Protocol } from './protocol';
import { cdpManager } from './CDPManager';
import { randomUUID } from './uuid';
import { startAsyncWork, wrapAsyncFunction } from './async';
import { AskPasswordBlock } from './AskPasswordBlock';
import { ChartBlock } from './ChartBlock';
import { somethingSelected } from './selection';
import type { Runtime } from '../slug/shell/runtime-types';
import type { Editor } from '../slug/editor/js/editor';
import type { Action } from './actions';
import { themeName } from './theme';
import { IntroBlock } from './IntroBlock';
import { BrowserShell } from './BrowserShell';

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
  addItem(item: LogItem, parent?: LogItem): void;
  removeItem(item: LogItem): void;
  clearAllAbove(item: LogItem): void;
  togglePrompt(showPrompt: boolean): void;
  setActiveItem(item: LogItem|null): void;
  setFullscreenItem(item: LogItem|null): void;
  setSuffix(suffix: string): void;
  scrollToBottom(): void;
  addRetainer(params: {item: LogItem|'forced', parent: LogItem}): void;
  removeRetainer(params: {item: LogItem|'forced', parent: LogItem}): void;
  cancelLLMRequest(): void;
  triggerLLMInvestigation(): void;
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

let shellLanguages = ['shjs', 'bash', 'python', 'javascript'] as const;
declare var IS_REPL: boolean|undefined;
if (typeof IS_REPL !== 'undefined' && IS_REPL)
  // @ts-ignore
  shellLanguages = ['python'] as const;
export type Language = typeof shellLanguages[number];
const languageToMode: {[key in Language]: string} = {
  'shjs': 'shjs',
  'javascript': 'js',
  'python': 'py',
  'bash': 'sh',
};
export class Shell {
  private _fullscreenItem: JoelEvent<LogItem> = new JoelEvent<LogItem>(null);
  private _activeItem = new JoelEvent<LogItem>(null);
  private _cachedEvaluationResult = new Map<string, Promise<string>>();
  private _connections: JSConnection[] = [];
  private _urlForIframeForConncetion = new WeakMap<JSConnection, (filePath: string) => Promise<string>>();
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
  private _history = new History();
  //@ts-ignore
  private _uuid: string = randomUUID();
  private _activeCommandBlock?: CommandBlock;
  private _setupUnlock: () => void;
  private _leftoverStdin = '';
  private _lastCommandWasError = false;
  private _lastCommandWasNew = false;
  private _language = new JoelEvent<Language>(shellLanguages[0]);
  private _prompt: Editor|null = null;
  private _commandPrefix: Element|null = null;
  private _tryToTransferPreview: null|((command: string) => null|Protocol.Runtime.evaluateReturnValue) = null; 
  constructor(private _delegate: ShellDelegate) {
    console.time('create shell');
    host.notify({ method: 'reportTime', params: {name: 'start create shell' } });
    this._setupUnlock = this._lockPrompt('setupInitialConnection');
    this._connectionNameElement.classList.add('connection-name');
    this._connectionNameEvent.on(name => {
      this._connectionNameElement.textContent = name;
    });
    this._fullscreenItem.on(item => this._delegate.setFullscreenItem(item));
    this._activeItem.on(item => this._delegate.setActiveItem(item));
    this._delegate.togglePrompt(!this._promptLocks.size);
    this._language.on(language => {
      this._prompt?.setMode(languageToMode[language]);
      this._commandPrefix?.setAttribute('data-language', languageToMode[this._language.current]);
      host.notify({ method: 'saveItem', params: { key: 'language', value: language}});
    });
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
    const cwd = this._connections[0] ? this._connections[0].cwd : await host.sendMessage({ method: 'loadItem', params: { key: 'cwd' }}) || '';
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
            cwd,
            socketId,
          }
        });
      },
      isRestoration: false,
    }
    socketListeners.set(socketId, message => core.onmessage?.(message));
    return this._setupConnectionInner(core, args);
  }
  _createTerminalHandler({connection, sendInput, urlForIframe, addItem, antiFlicker, shouldLockPrompt}: {
    connection: JSConnection,
    sendInput: (params: {data: string, id: string|number}) => Promise<void>,
    urlForIframe: (filePath: string) => Promise<string>,
    addItem: (item: LogItem, focus: boolean) => void;
    shouldLockPrompt: boolean,
    antiFlicker: AntiFlicker,
  }) {
    const terminals = new Map<number|string, {processor: TerminalDataProcessor, cleanup: () => Promise<void>}>();
    let myActiveItem: LogItem = null;
    const handler = {
      data: ({data, id}: {data: string, id: number|string}) => {
        // we might have lost the terminal creation due to data smooshing
        // make it anyway to be nice
        // TODO check if it has already ended?
        if (!terminals.has(id))
          handler.startTerminal({id});
        terminals.get(id).processor.processRawData(data);
      },
      endTerminal:async ({id}: {id: number|string}) => {
        const {cleanup} = terminals.get(id);
        terminals.delete(id);
        if (myActiveItem === this._activeItem.current)
          this._activeItem.dispatch(null);
        await cleanup();
      },
      startTerminal:({id}: {id: number|string}) => {
        if (terminals.has(id))
          console.error('terminal already exists', id);
        const sendInputToThisTerminal = (data: string) => {
          return sendInput({data, id});
        };
        const unlockPrompt = shouldLockPrompt ? this._lockPrompt('startTerminal ' + id) : () => void 0;
        let activeTerminalBlock: TerminalBlock = null;
        let activeIframeBlock: IFrameBlock = null;
        let activeProgressBlock: ProgressBlock = null;
        this._refreshActiveIframe = () => {
          activeIframeBlock?.refresh();
        };
        let activeChartBlock: ChartBlock = null;
        const terminalTaskQueue = new TaskQueue();
        const processor = new TerminalDataProcessor({
          htmlTerminalMessage: (type, dataStr) => {
            switch(type) {
              case 66: {
                // Browser
                terminalTaskQueue.queue(async () => {
                  await closeActiveTerminalBlock();
                  let dataObj: {entry: string};
                  try {
                  if (dataStr.startsWith('{'))
                    dataObj = JSON.parse(dataStr)
                  else
                    dataObj = {entry: dataStr};
                  }
                  catch { }
                  if (!dataObj)
                    dataObj = { entry: 'uh-oh-invalid-parse-entry???!!!' };
                  const unlock = this._lockPrompt('BrowserShell');
                  const block = new BrowserShell(String(dataObj.entry), unlock);
                  addItem(block, /* focus */ true);
                  block.setIsFullscreen(true);
                });
                break;
              }
              case 67: {
                // chart data
                if (!activeChartBlock) {
                  activeChartBlock = new ChartBlock();
                  terminalTaskQueue.queue(async () => {
                    await closeActiveTerminalBlock();
                    addItem(activeChartBlock, /* focus */ false);
                    await addTerminalBlock();
                  });
                }
                const chartData = JSON.parse(dataStr);
                if (Array.isArray(chartData)) {
                  // if we have steps, sorting will make appending much faster
                  if (chartData.every(x => 'step' in x))
                    chartData.sort((a, b) => a.step - b.step);
                  chartData.forEach(chartData => activeChartBlock.appendUserData(chartData));
                } else {
                  activeChartBlock.appendUserData(chartData);
                }
                break;
              }
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
                    sendInput: sendInputToThisTerminal,
                    connection,
                    urlForIframe,
                    antiFlicker,
                    browserView: !!(dataObj.browserView),
                    tryToRunCommand: (command: string) => {
                      const commandLooksSafe = checkIfCommandLooksSafe(command);
                      if (!commandLooksSafe && !confirm('Run potentially dangerous command?\n\n' + command))
                        return;
                      this.runCommand(command, 'shjs');
                    },
                  });
                  activeIframeBlock = iframeBlock;
                  addItem(iframeBlock, /* focus */ true);
                  cdpManager.setDebuggingInfoForTarget(this._uuid, iframeBlock.debugginInfo());
                });
                break;
              }
              case 77:
              case 81:
                // message
                terminalTaskQueue.queue(async () => {
                  if (!activeIframeBlock) {
                    console.error('parse error, sending message without iframe');
                    return;
                  }
                  activeIframeBlock.message(dataStr, /* dontCache */ type === 81);
                });
                break;
              case 78:
                // progress
                if (!activeProgressBlock) {
                  activeProgressBlock = new ProgressBlock();
                  terminalTaskQueue.queue(async () => {
                    await closeActiveTerminalBlock();
                    addItem(activeProgressBlock, /* focus */ false);
                    await addTerminalBlock();
                  });
                }
                activeProgressBlock.setProgress(JSON.parse(dataStr));
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
                // this should only be a uuid. dont notify otherwise in case its some kind of strange injection attempt
                if (!/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/.test(dataStr))
                  break;
                sendInputToThisTerminal(dataStr);
                break;
              }
              default:
                console.error('unhandled terminal message type', type);
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
              activeIframeBlock?.didClose();
              activeProgressBlock?.deactivate();
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
            sendInput: sendInputToThisTerminal,
            size: this._size,
            antiFlicker,
          });
          activeTerminalBlock = terminalBlock;
          const onFullScreen = (value: boolean) => {
            if (value)
              this._fullscreenItem.dispatch(terminalBlock);
            else if (this._fullscreenItem.current === terminalBlock)
              this._fullscreenItem.dispatch(null);
          };
          const onClear = () => {
            this._delegate.clearAllAbove(terminalBlock);
          };    
          terminalBlock.fullscreenEvent.on(onFullScreen);
          terminalBlock.clearEvent.on(onClear);
          addItem(terminalBlock, /* focus */ !activeIframeBlock);
        };
        terminalTaskQueue.queue(() => addTerminalBlock());
      },
      endAllTerminals: () => {
        for (const id of terminals.keys())
          handler.endTerminal({id});
      }
    };
    return handler;
  }

  _logMessageToUser(message: string) {
    this.addItem(new JSLogBlock({
      type: 'log',
      args: [{
        type: 'string',
        value: message,
      }],
      executionContextId: -1,
      timestamp: 0,
    }, this.connection, this._size));
  }

  async _setupConnectionInner(core: ConnectionCore, args: string[], sshAddress = null) {
    this._clearCache();
    const connection = new JSConnection(core);
    core.onclose = () => {
      if (!destroyed)
        this._logMessageToUser('Connection closed.');
      destroy();
      connection.didClose();
    }
    this._connectionIsDaemon.set(connection, false);
    const urlForIframe = (filePath: string) => core.urlForIframe(filePath, []);
    this._urlForIframeForConncetion.set(connection, urlForIframe);
    connection.on('Shell.daemonStatus', ({isDaemon}) => {
      this._connectionIsDaemon.set(connection, isDaemon);
      this._updateSuffix();
    });
    this._connectionToSSHAddress.set(connection, sshAddress);
    const filePath = args[0];
    this._connectionToName.set(connection, filePath || sshAddress);
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
    const evaluationsToPush = new Map<number, (result: string) => void>();
    // To avoid round trip latency, the backend will push evaluation results it thinks we need
    connection.on('Shell.willPushEvaluation', ({id, code}) => {
      this._cachedEvaluationResult.set(code, new Promise(resolve => {
        evaluationsToPush.set(id, resolve);
      }));
    });
    connection.on('Shell.pushEvaluation', ({id, result, exitCode}) => {
      if (!evaluationsToPush.has(id)) {
        console.error('evaluation not found', {id, result, exitCode});
        return;      
      }
      evaluationsToPush.get(id)?.(result.trim());
      evaluationsToPush.delete(id);
    });
    const terminalHandler = this._createTerminalHandler({
      sendInput: params => connection.send('Shell.input', params),
      connection,
      urlForIframe,
      shouldLockPrompt: false,
      antiFlicker: this._antiFlicker,
      addItem: (item, focus) => {
        this.addItem(item);
        if (focus)
          this._activeItem.dispatch(item);
      },
    });
    const handler: {[key in keyof Runtime]: (params: Runtime[key]) => void} = {
      ...terminalHandler,
      cwd: cwd => {
        connection.cwd = cwd;
        if (this._connections[0] === connection)
          host.notify({ method: 'saveItem', params: { key: 'cwd', value: cwd}});  
      },
      leftoverStdin: ({id,data}) => {
        this._leftoverStdin += data;
      },
      aliases: (aliases) => {
      },
      bashState: (state) => {
      },
      bashFunctions: (functions) => {
      },
      env: (env: {[key: string]: string}) => {
        for (const [key, value] of Object.entries(env)) {
          if (value === null)
            delete connection.env[key];
          else
            connection.env[key] = value;
        }
      },
      nod: async (args: string[]) => {
        const done = startAsyncWork('nod');
        const unlockPrompt = this._lockPrompt('nod');
        // TODO switch to Shell.createNodSubshell
        await this._setupConnection(args);
        unlockPrompt();
        done();
      },
      ssh: async ({sshAddress, sshArgs, env}: {sshAddress: string, sshArgs: string[], env: Record<string, string>}) => {
        const done = startAsyncWork('ssh');
        const unlockPrompt = this._lockPrompt('ssh');
        const sshCore = await this._createSubshell(connection, core, { sshAddress, sshArgs, env })
        // Setting up ssh may have failed or been canceled
        if (sshCore)
          await this._setupConnectionInner(sshCore, [], sshAddress);
        unlockPrompt();
        done();
      },
      reconnect: async (socketPath: string) => {
        const done = startAsyncWork('reconnect');
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
      terminalHandler.endAllTerminals(),
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
    await connection.send('Shell.enable', {
      args,
      env: {
        SNAIL_THEME: themeName(),
      },
    });
    const resize = (size: {rows: number, cols: number}) => this.connection.send('Shell.resize', size);
    this._size.on(resize);
    resize(this._size.current);

    if (typeof IS_REPL === 'undefined' || !IS_REPL) {
      const {result, exceptionDetails} = await connection.send('Runtime.evaluate', {
        expression: `({env: {...process.env}, cwd: process.cwd()})`,
        returnByValue: true
      });
      connection.env = result.value.env;
      connection.cwd = result.value.cwd;
    }
    if (core.isRestoration) {
      let error;
      const result = await connection.send('Shell.restore', undefined).catch(e => {
        error = e;
        return null;
      });
      // the script could cause the shell to be destroyed
      if (error) {
        this._connectionToDestroy.get(connection)();
        return;
      }
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
    if (typeof IS_REPL !== 'undefined' && IS_REPL) {
      const closedIntro = await host.sendMessage({ method: 'loadItem', params: { key: 'closedIntro' }});
      if (!closedIntro)
        this.addItem(new IntroBlock());
    }
    await this._setupConnection([]);
    if (typeof IS_REPL === 'undefined' || !IS_REPL) {
      const { exitCode } = await this.connection.send('Shell.evaluate', {
        code: 'reconnect --list --quiet',
      });
      if (exitCode === 0)
        await this.runCommand('reconnect --list', 'shjs');
    }
    this._language.dispatch(await host.sendMessage({ method: 'loadItem', params: { key: 'language' }}) || shellLanguages[0]);
    console.timeEnd('create shell');
    this._setupUnlock(); // prompt starts locked
    host.notify({ method: 'reportTime', params: {name: 'create shell' } });
  }

  private get connection() {
    return this._connections[this._connections.length - 1];
  }

  async globalVars(): Promise<Set<string>> {
    if (typeof IS_REPL !== 'undefined' && IS_REPL)
      return new Set();
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

  async _transformCode(code: string, language: Language) {
    if (language === 'shjs') {
      const { transformCode } = await import('../slug/shjs/transform');
      const jsCode = transformCode(code, 'global.pty', await this.globalVars());
      return preprocessForJS(jsCode);
    }
    if (language === 'javascript')
      return preprocessForJS(code);
    if (language === 'bash')
      return `await global.pty('bash-eval \\'${code.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}\\'')`;
    return code;
  }
  async _isShellLikeCode(code: string, language: Language) {
    if (language === 'bash')
      return true;
    if (language !== 'shjs')
      return false;
    const { isShellLike } = await import('../slug/shjs/transform');
    return isShellLike(code, await this.globalVars());
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
    this._delegate.setSuffix(this._connectionIsDaemon.get(this.connection) ? ' 😈' : '');
  }

  close() {
    for (const connection of this._connections)
      this._connectionToDestroy.get(connection)();
  }

  async kill() {
    for (const connection of this._connections.reverse())
      await connection.send('Shell.kill', undefined).catch(e => {});
  }

  _setActiveCommandBlock(commandBlock: CommandBlock|null) {
    if (this._activeCommandBlock)
      this._delegate.removeRetainer({item: 'forced', parent: this._activeCommandBlock});
    if (commandBlock) {
      // never clear the command block as long as it is active
      this._delegate.addRetainer({item: 'forced', parent: commandBlock});
      this._activeCommandBlock = commandBlock;
    }else {
      delete this._activeCommandBlock;
    }
  }

  async runCommand(command: string, language: Language) {
    const commandBlock = new CommandBlock(command,
      this._size,
      this._connectionNameEvent.current,
      {...this.env},
      this.cwd,
      languageToMode[language],
      this._cachedGlobalVars, 
      this.sshAddress);
    this._lastCommandWasError = false;
    this._lastCommandWasNew = false;
    commandBlock.cachedEvaluationResult = this._cachedEvaluationResult;
    this.addItem(commandBlock);
    this._delegate.scrollToBottom();
    if (!command)
      return;
    this._setActiveCommandBlock(commandBlock);
    const transferResult = this._tryToTransferPreview?.(command);
    const unlockPrompt = this._lockPrompt('runCommand');
    this._activeItem.dispatch(commandBlock);
    const updateHistory = await this._addToHistory(command, language);
    const isNewCommand = await this._isNewCommand(command);
    const expression = await this._transformCode(command, language);
    let error;
    const connection = this.connection;
    this._clearCache();
    const beforeCwd = connection.cwd;
    const result: ReturnType<ExtraClientMethods['Shell.runCommand']> = transferResult || await connection.send('Shell.runCommand', {
      expression,
      command,
      language,
    }).catch(e => {
      error = e;
      return null;
    });
    // the script could cause the shell to be destroyed
    if (error) {
      this._connectionToDestroy.get(connection)();
      if (this._connections.length === 0) {
        this._delegate.shellClosed();
        cdpManager.removeDebuggingInfoForTarget(this._uuid);
        return;
      }
      this._setActiveCommandBlock(null);
      unlockPrompt();
      return;
    }
    // TODO update the prompt line here?
    if (updateHistory) {
      await updateHistory('end', Date.now());
      // TODO need a new history output format that considers terminal and js
      await updateHistory('output', JSON.stringify(result));
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
    if (language !== 'python' || result.result?.type !== 'undefined')
      this._addJSBlock(result, connection, commandBlock);
    this._lastCommandWasNew = isNewCommand;
    this._setActiveCommandBlock(null);
    delete this._activeCommandBlock;
    unlockPrompt();
    if (beforeCwd !== connection.cwd && await this.evaluate('echo $SNAIL_SHOULD_INVESTIGATE'))
      this._delegate.triggerLLMInvestigation();
  }

  _addJSBlock(result: Protocol.CommandReturnValues['Runtime.evaluate'], connection: JSConnection, commandBlock?: CommandBlock) {
    if (result.result?.type === 'string' && result.result.value.startsWith('this is the secret secret string:')) {
      const exitCode = parseInt(result.result.value.substring('this is the secret secret string:'.length));
      commandBlock?.setExitCode(exitCode);
      this._lastCommandWasError = (exitCode !== 0) && (exitCode !== 130);
      return;
    }
    const jsBlock = new JSBlock(result.exceptionDetails ? result.exceptionDetails.exception : result.result, connection, this._size);

    this.addItem(jsBlock);
  }

  async _isNewCommand(command: string) {
    if (typeof IS_REPL !== 'undefined' && IS_REPL)
      return false;
    const pwd = await this.cachedEvaluation('pwd');
    return this._history.isNewCommand({ command, pwd, sshAddress: this.sshAddress });
  }

  async evaluate(code: string): Promise<string> {
    const {result} = await this.connection.send('Shell.evaluate', {
      code,
    });
    return result.trim();
  }

  async evaluateStream(code: string, callback: (chunk: string) => void): Promise<void> {
    let tick: (data?: string) => void;
    const dataListener = (event: { streamId: number, data: string}) => {
      if (event.streamId !== streamId)
        return;
      bufferedData.push(event.data);
      tick();
    };
    let ended = false;
    const endListener = (event: {streamId: number}) => {
      if (event.streamId !== streamId)
        return;
      ended = true;
      tick();
    };
    let bufferedData: string[] = [];
    let dataIndex = 0;
    this.connection.on('Shell.evaluateStreamingData', dataListener);
    this.connection.on('Shell.evaluateStreamingEnd', endListener);
    const {streamId} = await this.connection.send('Shell.evaluateStreaming', {
      code,
    });
    while (true) {
      if (ended)
        break;
      if (bufferedData.length <= dataIndex) {
        await new Promise(x => tick = x);
        continue;
      }
      callback(bufferedData[dataIndex]);
      dataIndex++;
    }
    this.connection.off('Shell.evaluateStreamingData', dataListener);
    this.connection.off('Shell.evaluateStreamingEnd', endListener);
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
      this._cachedEvaluationResult.set(code, this.evaluate(code));
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
      
      const items: MenuItem[] = [];
      if (typeof IS_REPL === 'undefined' || !IS_REPL) {
        const currentPwd = await this.cachedEvaluation('pwd');
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
        items.push({});
      }      
      items.push({
        title: 'Shell Language',
        submenu: shellLanguages.map(language => {
          return {
            title: language,
            checked: language === this._language.current,
            accelerator: {
              'shjs': 'S',
              'javascript': 'J',
              'python': 'P',
              'bash': 'B',
            }[language],
            callback: async () => {
              if (language === this._language.current)
                return;
              this._language.dispatch(language);
            }
          };
        }),
      });
      await showContextMenu(items);
    });
    this._commandPrefix = commandPrefix.element;
    this._commandPrefix?.setAttribute('data-language', languageToMode[this._language.current]);
    editorLine.append(commandPrefix.element);
    
    const prettyName = computePrettyDirName(this, this.cwd);
    const title = [this._connectionToName.get(this.connection), prettyName].filter(Boolean).join(' ');
    Promise.race([commandPrefix.render(), new Promise(x => setTimeout(x, 100))]).then(() => {
      element.style.removeProperty('opacity');
    });
    const editorWrapper = document.createElement('div');
    editorWrapper.style.position = 'relative';
    editorWrapper.style.flex = '1';
    editorWrapper.style.minHeight = '1.4em';
    editorWrapper.addEventListener('keydown', async event => {
      const finishWork = startAsyncWork('User Evaluation');
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
              let shouldNewline = false;
              if (this._language.current === 'shjs') {
                const code = await this._transformCode(editor.text(), 'shjs');
                shouldNewline = isUnexpectedEndOfInput(code);
              } else if (this._language.current === 'javascript') {
                shouldNewline = isUnexpectedEndOfInput(editor.text());
              } else if (this._language.current === 'python') {
                shouldNewline = await this.connection.send('Python.isUnexpectedEndOfInput', { code: editor.text() })
              } else {
                // TODO check for unexpected end of input in other languages
                console.warn('unimplemented unexpected end of input check for language', this._language.current);
              }
              if (shouldNewline) {
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
        await this.runCommand(command, this._language.current);
      } else if (event.code === 'KeyC' && event.ctrlKey) {
        const isMac = navigator['userAgentData']?.platform === 'macOS' || navigator.platform === 'MacIntel';
        if (isMac || !somethingSelected()) {
          const commandBlock = new CommandBlock(
            editor.value,
            this._size,
            this._connectionNameEvent.current,
            {...this.env},
            this.cwd,
            languageToMode[this._language.current],
            this._cachedGlobalVars,
            this.sshAddress,
          );
          commandBlock.cachedEvaluationResult = this._cachedEvaluationResult;
          commandBlock.wasCanceled = true;
          this.addItem(commandBlock);
          
          editor.value = '';
          editor.selections = [{start: {column: 0, line: 0}, end: {column: 0, line: 0}}];
          this._delegate.scrollToBottom();

          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }
      finishWork();
    }, true);
    editorLine.appendChild(editorWrapper);
    const {editor, autocomplete} = makePromptEditor(this, this._language);
    this._prompt = editor;
    const loc = editor.replaceRange(this._leftoverStdin, { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } });
    editor.selections = [{ start: loc, end: loc }];
    this._leftoverStdin = '';
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
    let abortController = new AbortController();
    let lastPreviewValue = '';
    let belowPromptItems: LogItem[] = [];
    const clearBelowPrompt = () => {
      willResizeEvent.dispatch();
      belowPrompt.textContent = '';
      for (const item of belowPromptItems)
        item.dispose();
      belowPromptItems = [];
      this._tryToTransferPreview = null;
    }
    let dontCancelLLM = false;
    const onChange = wrapAsyncFunction('shell preview', async () => {
      if (this._language.current === 'bash') {
        clearBelowPrompt();
        return;
      }
      if (!dontCancelLLM)
        this._delegate.cancelLLMRequest();
      const value = autocomplete.valueWithSuggestion();
      await autocomplete.waitForQuiet();
      if (value !== autocomplete.valueWithSuggestion())
        return;
      if (value === lastPreviewValue)
        return;
      abortController?.abort();
      abortController = new AbortController();
      const signal = abortController.signal;
      lastPreviewValue = value;
      if (!value.trim()) {
        clearBelowPrompt();
        return;
      }
      const isShellLike = await this._isShellLikeCode(value, this._language.current);
      if (isShellLike) {
        if (signal.aborted)
          return;
        const {result, notifications} = await this.connection.send('Shell.previewShellCommand', {
          command: value,
        }, signal);
        await new Promise(requestAnimationFrame);
        if (signal.aborted)
          return;
        const exitCode = result.result?.type === 'string' ?
          parseInt(result.result.value.substring('this is the secret secret string:'.length)) :
          1;
        // 82 to match the exit code of an uncachable command
        if (exitCode !== 0 && exitCode !== 82) {
          clearBelowPrompt();
          return;
        }
        const items: LogItem[] = [];
        let resolveFlickerPromise: () => void;
        const flickerPromise = new Promise<void>(x => resolveFlickerPromise = x);
        const antiFlicker = new AntiFlicker(() => void 0, resolveFlickerPromise);
        const terminalHandler = this._createTerminalHandler({
          connection: this.connection,
          antiFlicker,
          shouldLockPrompt: false,
          sendInput: () => {throw new Error('shell preview should not have user input')},
          urlForIframe: this._urlForIframeForConncetion.get(this.connection)!,
          addItem: (item, focus) => {
            if (signal.aborted)
              item.dispose();
            else
              items.push(item);
          },
        });
        const promises: Promise<any>[] = [];
        for (const {method, params} of notifications)
          promises.push(terminalHandler[method](params));
        const didDraw = antiFlicker.expectToDraw(250)
        await Promise.all(promises);
        const newDiv = document.createElement('div');
        newDiv.style.visibility = 'hidden';
        belowPrompt.appendChild(newDiv);
        const oldItems = belowPromptItems;
        belowPromptItems = [];
        for (const item of items) {
          belowPromptItems.push(item);
          const element = item.render();
          if (element)
            newDiv.appendChild(element);
          item?.wasShown?.();
        }
        this._tryToTransferPreview = (command: string) => {
          if (command !== value)
            return null;
          if (exitCode !== 0)
            return null;
          for (const item of belowPromptItems)
            this.addItem(item);
          belowPromptItems = [];
          clearBelowPrompt();
          return result;
        };
        didDraw();
        await flickerPromise;
        newDiv.style.removeProperty('visibility');
        for (const child of belowPrompt.childNodes) {
          if (child !== newDiv)
            child.remove();
        }
        for (const item of oldItems)
          item.dispose();
        return;
      }
      const code = await this._transformCode(value, this._language.current);
      // throttle a bit
      await new Promise(requestAnimationFrame);
      if (signal.aborted)
        return;
      if (!code.trim()) {
        clearBelowPrompt();
        return;
      }
      const result = await this.connection.send('Shell.previewExpression', {
        expression: code,
        language: this._language.current,
      });
      if (signal.aborted)
        return;
      clearBelowPrompt();
      if (!result)
        return;
      belowPrompt.append(renderRemoteObjectOneLine(result, this._size.current.cols));
    });

    const willResizeEvent = new JoelEvent<void>(undefined);
    editor.on('change', onChange);
    editor.on('might-resize', () => {
      willResizeEvent.dispatch()
    });
    autocomplete.suggestionChanged.on(onChange);
    return {
      titleChangedEvent: new JoelEvent<string>(title),
      render: () => element,
      dispose: () => {
        abortController?.abort();
        clearBelowPrompt();
        belowPromptItems = [];
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
      setFind() {
        // TODO prompt find
      },
      flushForLLM: async () => {
        if (!editor.value)
          return;
        const old = editor.value;
        dontCancelLLM = true;
        editor.value = '';
        dontCancelLLM = false;
        await this.runCommand(old, this._language.current);
      },
      recieveLLMAction: async (iterator, signal) => {
        let value = '';
        for await (const chunk of iterator) {
          if (signal.aborted)
            break;
          if (!chunk)
            continue;
          value += chunk;
          // a user typing in the prompt will cancel an llm action
          // set this flag so it doesnt.
          dontCancelLLM = true;
          editor.value = value;
          editor.selectAll();
          dontCancelLLM = false;
        }
      },
      recieveFilePath: filePath => {
        const beforeRange = editor.selections[0] || {
          start: { column: 0, line: 0},
          end: { column: 0, line: 0 }
        };
        editor.replaceRange(filePath, beforeRange);
        editor.selections = [{
          start: beforeRange.start,
          end: {
            column: beforeRange.start.column + filePath.length,
            line: beforeRange.start.line,
          }
        }];
      }
    }
  }

  async _addToHistory(command: string, langauge: Language) {
    if (!command)
      return;
    if (typeof IS_REPL !== 'undefined' && IS_REPL)
      return this._history.addHistory(command, langauge);
    const [updateHistory, pwd, home, revName, dirtyState, hash] = await Promise.all([
      this._history.addHistory(command, langauge),
      this.cachedEvaluation('pwd'),
      this.cachedEvaluation('echo $HOME'),
      this.cachedEvaluation('__git_ref_name'),
      this.cachedEvaluation('__is_git_dirty'),
      this.cachedEvaluation('GIT_OPTIONAL_LOCKS=0 git rev-parse HEAD'),
    ]);
    await Promise.all([
      updateHistory('home', home),
      updateHistory('pwd', pwd),
      updateHistory('git_branch', revName),
      updateHistory('git_dirty', dirtyState),
      updateHistory('git_hash', hash),
      this.sshAddress && updateHistory('hostname', this.sshAddress),
    ]);
    return updateHistory;
  }

  searchHistory(current: string, prefix: string, start: number, direction: 1|-1) {
    return this._history.searchHistory(current, prefix, start, direction);
  }

  addItem(item: LogItem) {
    this._delegate.addItem(item, this._activeCommandBlock);
  }

  async jsCompletions(prefix: string) {
    const key = 'js:' + prefix;
    if (!this._cachedSuggestions.has(key)) {
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
      this._cachedSuggestions.set(key, inner());
    }
    return this._cachedSuggestions.get(key);
  }

  pythonCompletions(line: string) {
    return this.connection.send('Python.autocomplete', { line });
  }

  async findAllFiles(maxFiles: number, callback: (path: string) => void) {
    let prefix = '';
    await this.evaluateStream(`__find_all_files ${maxFiles}`, chunk => {
      const lines = (prefix + chunk).split('\n');
      prefix = lines.pop();
      for (const line of lines)
        callback(line);
    });
  }

  lastCommandWasError(): boolean {
    return this._lastCommandWasError;
  }

  lastCommandWasNew(): boolean {
    return this._lastCommandWasNew;
  }

  actions(): Action[] {
    const shortcuts = {
      'shjs': 'Meta+K S',
      'bash': 'Meta+K B',
      'python': 'Meta+K P',
      'javascript': 'Meta+K J',
    };
    return [...((shellLanguages.length as number) === 1 ? [] : shellLanguages).map(language => {
      return {
        id: `shell-language-${language}`,
        title: `Switch shell to ${language}`,
        callback: () => {
          this._language.dispatch(language);
        },
        shortcut: shortcuts[language],
      }
    }), {
      id: 'python.reset',
      title: 'Reset Python',
      callback: async () => {
        await this.connection.send('Python.reset', void 0);
      },
      needsFullSnail: true,
    }]
  }

  async investigateWithAI(command: string): Promise<LLMMessage|null> {
    console.log('investigateWithAI', command);
    if (!command)
      return null;
    if (!this._isShellLikeCode(command, 'shjs'))
      return null;
    const {exitCode, result} = await this.connection.send('Shell.evaluate', {
      code: command,
      noSideEffects: true,
    });
    if (exitCode !== 0)
      return null;
    return {
      role: 'user',
      content: result,
    }
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

function checkIfCommandLooksSafe(command: string) {
  if (/^show [\/\w\-\.\"\\]*$/.test(command))
    return true;
  if (/^reconnect [\/\w\-\.]*$/.test(command))
    return true;
  if (/^ls \"[\/\w\-\.]*\"$/.test(command))
    return true;
  return false;
}