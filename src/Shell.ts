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
  public addItemEvent = new JoelEvent<LogItem>(null);
  public clearEvent = new JoelEvent<void>(undefined);
  private _cachedEvaluationResult = new Map<string, Promise<string>>();
  private _connection: JSConnection;
  private constructor(private _shellId: number, url: string) {
    this._connection = new JSConnection(new WebSocket(url));
  }
  private _size = new JoelEvent(size);
  static async create(): Promise<Shell> {
    const {shellId, url} = await window.electronAPI.sendMessage({
      method: 'createShell',
    });
    const shell = new Shell(shellId, url);
    shells.set(shellId, shell);
    shell._connection.on('Runtime.consoleAPICalled', message => {
      if (message.stackTrace?.callFrames[0]?.functionName === 'timeLogImpl')
        return;
      shell.addItem(new JSLogBlock(message, shell._connection));
      console.log(message);
    });
    const terminals = new Map<number, TerminalBlock>();
    const handler = {
      data: ({data, id}: {data: string, id: number}) => {
        terminals.get(id).addData(data);
      },
      endTerminal:({id}: {id: number}) => {
        const terminalBlock = terminals.get(id);
        terminalBlock.activeEvent.dispatch(false);
        shell.activeItem.dispatch(null);
        terminalBlock.close();
      },
      startTerminal:({id}: {id: number}) => {
        const terminalBlock = new TerminalBlock(shell._size, async data => {
          await notify('input', { data, id});
        });
        terminals.set(id, terminalBlock);
        shell.addItem(terminalBlock);
        shell.activeItem.dispatch(terminalBlock);
      },
      cwd: () => {},
      aliases: () => {},
      env: () => {},
    }
    shell._connection.on('Runtime.bindingCalled', message => {
      if (message.name !== "magic_binding")
        return;
      const {method, params} = JSON.parse(message.payload);
      handler[method](params);
    });
    await shell._connection.send('Runtime.enable', {});
    await shell._connection.send('Runtime.addBinding', {
      name: 'magic_binding',
    });
    const {result: {objectId: notifyObjectId}} = await shell._connection.send('Runtime.evaluate', {
      expression: 'bootstrap()',
      returnByValue: false,
    });
    async function notify(method: string, params: any) {
      await shell._connection.send('Runtime.callFunctionOn', {
        objectId: notifyObjectId,
        functionDeclaration: `function(data) { return this(data); }`,
        arguments: [{
          value: {method, params}
        }]
      });
    }

    await shell.updateSize();
    return shell;
  }
  async runCommand(command: string) {
    const commandBlock = new CommandBlock(command);
    commandBlock.cachedEvaluationResult = this._cachedEvaluationResult;
    this.addItem(commandBlock);
    if (!command)
      return;
    this.activeItem.dispatch(commandBlock);
    const historyId = await this._addToHistory(command);
    const result = await this._connection.send('Runtime.evaluate', {
      expression: preprocessForJS(command),
      returnByValue: false,
      generatePreview: true,
      userGesture: true,
      replMode: true,
      allowUnsafeEvalBlockedByCSP: true,
    });
    if (historyId) {
      await updateHistory(historyId, 'end', Date.now());
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
    if (result.result?.type === 'string' && result.result.value === 'this is the secret secret string')
      return;
    const jsBlock = new JSBlock(result.exceptionDetails ? result.exceptionDetails.exception : result.result, this._connection);

    this.addItem(jsBlock);
  }

  async runCommandSH(command: string) {
    const commandBlock = new CommandBlock(command);
    commandBlock.cachedEvaluationResult = this._cachedEvaluationResult;
    const terminalBlock = new TerminalBlock(this._size, this._shellId);
    let didClear = false;
    this.addItem(commandBlock);
    this.addItem(terminalBlock);
    const onFullScreen = (value: boolean) => {
      this.fullscreenItem.dispatch(value ? terminalBlock : null);
    }
    const onClear = () => {
      for (const item of this.log) {
        if (item !== terminalBlock && item !== commandBlock)
          item.dispose();
      }
      this.log = [commandBlock, terminalBlock];
      didClear = true;
      this.clearEvent.dispatch();
    }
    terminalBlock.fullscreenEvent.on(onFullScreen);
    terminalBlock.clearEvent.on(onClear);
    terminalBlock.activeEvent.dispatch(true);
    this.activeItem.dispatch(terminalBlock);
    const historyId = await this._addToHistory(command);
    await window.electronAPI.sendMessage({
      method: 'runCommand',
      params: {
        shellId: this._shellId,
        command,
      },
    });
    terminalBlock.fullscreenEvent.off(onFullScreen);
    this.fullscreenItem.dispatch(null);
    this._cachedEvaluationResult = new Map();
    this.activeItem.dispatch(null);
    terminalBlock.activeEvent.dispatch(false);
    await terminalBlock.close();
    if (historyId) {
      await updateHistory(historyId, 'end', Date.now());
      let output = '';
      for (const data of terminalBlock.allData()) {
        if (typeof data === 'string')
          output += data;
        else
          output += new TextDecoder().decode(data);
      }
      await updateHistory(historyId, 'output', output);
    }

    terminalBlock.clearEvent.off(onClear);
    if (didClear && terminalBlock.empty) {
      this.log = [];
      this.clearEvent.dispatch();
    }
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
    await window.electronAPI.sendMessage({
      method: 'resize',
      params: {
        cols: size.cols,
        rows: size.rows,
        shellId: this._shellId,
      },
    });
  }

  async cachedEvaluation(code: string): Promise<string> {
    if (!this._cachedEvaluationResult.has(code))
      this._cachedEvaluationResult.set(code, this.evaluate(code));;
    return this._cachedEvaluationResult.get(code);
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

