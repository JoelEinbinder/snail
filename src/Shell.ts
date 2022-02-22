import 'xterm/css/xterm.css';
import { addHistory, updateHistory } from './history';
import { makePromptEditor } from './PromptEditor';
import { JoelEvent } from './JoelEvent';
import type { LogItem } from './LogView';
import { CommandBlock, CommandPrefix } from './CommandBlock';
import { TerminalBlock } from './TerminalBlock';
import { JSConnection } from './JSConnection';
import { JSBlock, JSLogBlock } from './JSBlock';
import { preprocessForJS, isUnexpectedEndOfInput } from './PreprocessForJS';

const shells = new Map<number, Shell>();

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

export class Shell {
  log: LogItem[] = [];
  public fullscreenItem: JoelEvent<LogItem> = new JoelEvent<LogItem>(null);
  public activeItem = new JoelEvent<LogItem>(null);
  public promptLock = new JoelEvent<number>(0);
  public addItemEvent = new JoelEvent<LogItem>(null);
  public clearEvent = new JoelEvent<void>(undefined);
  private _cachedEvaluationResult = new Map<string, Promise<string>>();
  private _connection: JSConnection;
  private _notifyObjectId: string;
  private _size = new JoelEvent(size);
  private _cachedGlobalObjectId: string;
  private constructor(private _shellId: number, url: string) {
    this._connection = new JSConnection(new WebSocket(url));
    this._connection.on('Runtime.consoleAPICalled', message => {
      // console.timeEnd messages are sent twice
      if (message.stackTrace?.callFrames[0]?.functionName === 'timeLogImpl')
        return;
      this.addItem(new JSLogBlock(message, this._connection));
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
        cleanup();
        await block.close();
        if (block.cleared && block.empty) {
          block.dispose();
          this.log.splice(this.log.indexOf(block), 1);
          this.clearEvent.dispatch();
        }
      },
      startTerminal:({id}: {id: number}) => {
        const terminalBlock = new TerminalBlock(this._size, async data => {
          await this._notify('input', { data, id});
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
        console.log(cwd);
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
    }
    this._connection.on('Runtime.bindingCalled', message => {
      if (message.name !== "magic_binding")
        return;
      const {method, params} = JSON.parse(message.payload);
      handler[method](params);
    });
  }
  static async create(): Promise<Shell> {
    const {shellId, url} = await window.electronAPI.sendMessage({
      method: 'createShell',
    });
    const shell = new Shell(shellId, url);
    shells.set(shellId, shell);
    await shell._connection.send('Runtime.enable', {});
    await shell._connection.send('Runtime.addBinding', {
      name: 'magic_binding',
    });
    const {result: {objectId: notifyObjectId}} = await shell._connection.send('Runtime.evaluate', {
      expression: 'bootstrap()',
      returnByValue: false,
    });
    shell._notifyObjectId = notifyObjectId;

    await shell.updateSize();
    return shell;
  }

  async _notify(method: string, params: any) {
    await this._connection.send('Runtime.callFunctionOn', {
      objectId: this._notifyObjectId,
      functionDeclaration: `function(data) { return this(data); }`,
      arguments: [{
        value: {method, params}
      }]
    });
  }

  async globalVars() {
    const {names} = await this._connection.send('Runtime.globalLexicalScopeNames', {});
    const {result} = await this._connection.send('Runtime.getProperties', {
      objectId: await this.globalObjectId(),
      generatePreview: false,
      ownProperties: false,
      accessorPropertiesOnly: false,
    });
    const globalNames = result.filter(x => !x.symbol).map(x => x.name);
    return new Set(names.concat(globalNames));
  }

  async globalObjectId() {
    if (this._cachedGlobalObjectId)
      return this._cachedGlobalObjectId;
    const {result: {objectId}} = await this._connection.send('Runtime.evaluate', {
      expression: '(function() {return this})()',
      returnByValue: false,
    });
    return objectId;
  }
  async runCommand(command: string) {
    const commandBlock = new CommandBlock(command);
    commandBlock.cachedEvaluationResult = this._cachedEvaluationResult;
    this.addItem(commandBlock);
    if (!command)
      return;
    this._lockPrompt();
    this.activeItem.dispatch(commandBlock);
    const historyId = await this._addToHistory(command);
    const { transformCode } = await import('../shjs/transform');
    const jsCode = transformCode(command, 'global.pty', await this.globalVars());
    const result = await this._connection.send('Runtime.evaluate', {
      expression: preprocessForJS(jsCode),
      returnByValue: false,
      generatePreview: true,
      userGesture: true,
      replMode: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    this._cachedEvaluationResult = new Map();
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
    const jsBlock = new JSBlock(result.exceptionDetails ? result.exceptionDetails.exception : result.result, this._connection);

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
    this._notify('resize', size);
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

  addPrompt(container: Element) {
    const element = document.createElement('div');
    element.style.opacity = '0';
    element.classList.add('prompt');
    const isReady = new Promise<void>(resolve => {
      element.append(CommandPrefix(this, resolve));
    });
    Promise.race([isReady, new Promise(x => setTimeout(x, 100))]).then(() => {
      element.style.removeProperty('opacity');
    });
    const editorWrapper = document.createElement('div');
    editorWrapper.style.position = 'relative';
    editorWrapper.style.flex = '1';
    editorWrapper.style.minHeight = '14px';
    editorWrapper.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.shiftKey)
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.ctrlKey && !editor.somethingSelected()) {
        const start = editor.selections[0].start;
        if (start.line !== editor.lastLine) {
          if (start.column === editor.line(start.line).length) {
            editor.smartEnter();
            return;
          }
        } else {
          if (start.column === editor.line(start.line).length && isUnexpectedEndOfInput(editor.text())) {
            editor.smartEnter();
            return;
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
    element.appendChild(editorWrapper);
    const editor = makePromptEditor(this);
    editorWrapper.appendChild(editor.element);
    container.appendChild(element);
    editor.layout();
    editor.focus();
    return element;
  }

  async _addToHistory(command: string) {
    if (!command)
      return;
    const historyId = await addHistory(command);
    const pwd = await this.cachedEvaluation('pwd');
    const home = await this.cachedEvaluation('echo $HOME');
    const revName = await this.cachedEvaluation('__git_ref_name');
    const dirtyState = await this.cachedEvaluation('__is_git_dirty');
    const hash = await this.cachedEvaluation('GIT_OPTIONAL_LOCKS=0 git rev-parse HEAD');
  
    await updateHistory(historyId, 'home', home);
    await updateHistory(historyId, 'pwd', pwd);
    await updateHistory(historyId, 'git_branch', revName);
    await updateHistory(historyId, 'git_dirty', dirtyState);
    await updateHistory(historyId, 'git_hash', hash);
    return historyId;
  }

  addItem(item: LogItem) {
    this.log.push(item);
    this.addItemEvent.dispatch(item);
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

