import {Terminal, IDisposable} from 'xterm';
import 'xterm/css/xterm.css';
import { addHistory, updateHistory } from './history';
import React from 'react';
import { makePromptEditor } from './PromptEditor';
import { render } from 'react-dom';
import { JoelEvent } from './JoelEvent';
import type { LogItem } from './LogView';
import { CommandBlock, CommandPrefix } from './CommandBlock';
import { TerminalBlock } from './TerminalBlock';

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
  private constructor(private _shellId: number) { }
  private _size = new JoelEvent(size);
  static async create(): Promise<Shell> {
    const shellId = await window.electronAPI.sendMessage({
      method: 'createShell',
    });
    const shell = new Shell(shellId);
    shells.set(shellId, shell);
    await shell.updateSize();
    return shell;
  }
  async runCommand(command: string) {
    const commandBlock = new CommandBlock(command);
    commandBlock.cachedEvaluationResult = this._cachedEvaluationResult;
    const terminalBlock = new TerminalBlock(this._size, this._shellId);
    let didClear = false;
    this.log.push(commandBlock);
    this.addItemEvent.dispatch(commandBlock);
    this.log.push(terminalBlock);
    this.addItemEvent.dispatch(terminalBlock);
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
    element.classList.add('prompt');
    const editorWrapper = React.createRef<HTMLDivElement>();
    render(<>
      <CommandPrefix shellOrCommand={this} />
      <div ref={editorWrapper} style={{position: 'relative', flex: 1, minHeight: '14px'}}
      onKeyDown={event => {
        if (event.key !== 'Enter')
          return;
        const command = editor.value;
        editor.value = '';
        this.runCommand(command);
        event.stopPropagation();
        event.preventDefault();
      }} />
    </>, element);
    const editor = makePromptEditor(this);
    editorWrapper.current.appendChild(editor.element);
    container.appendChild(element);
    editor.layout();
    editor.focus();
    return () => {
      element.remove();
    };
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

