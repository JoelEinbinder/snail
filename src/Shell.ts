import {Terminal, IDisposable} from 'xterm';
import 'xterm/css/xterm.css';
import { addHistory, updateHistory } from './history';
import { JoelEvent } from './JoelEvent';
import { setSelection } from './selection';

window.electronAPI.onEvent('data', ({shellId, data}) => {
  const shell = shells.get(shellId);
  shell.log[shell.log.length - 1].addData(data);
});

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
  log: Entry[] = [];
  public fullscreenEntry: JoelEvent<Entry> = new JoelEvent<Entry>(null);
  public activeEntry = new JoelEvent<Entry>(null);
  public clearEvent = new JoelEvent<void>(undefined);
  private _cachedEvaluationResult = new Map<string, Promise<string>>();
  private constructor(private _shellId: number) { }
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
    const entry = new Entry(command, this._shellId);
    let didClear = false;
    this.log.push(entry);
    const onFullScreen = (value: boolean) => {
      this.fullscreenEntry.dispatch(value ? entry : null);
    }
    const onClear = () => {
      this.log = [entry];
      didClear = true;
      this.clearEvent.dispatch();
    }
    entry.cachedEvaluationResult = this._cachedEvaluationResult;
    entry.fullscreenEvent.on(onFullScreen);
    entry.clearEvent.on(onClear);
    entry.activeEvent.dispatch(true);
    this.activeEntry.dispatch(entry);
    await entry.addToHistory(this);
    await window.electronAPI.sendMessage({
      method: 'runCommand',
      params: {
        shellId: this._shellId,
        command,
      },
    });
    entry.fullscreenEvent.off(onFullScreen);
    this.fullscreenEntry.dispatch(null);
    this._cachedEvaluationResult = new Map();
    this.activeEntry.dispatch(null);
    entry.activeEvent.dispatch(false);
    await entry.close();
    entry.clearEvent.off(onClear);
    if (didClear && entry.empty) {
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
    for (const log of this.log) {
      log.updateSize();
    }
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
}
let lastEntryId = 0;
export class Entry {
  element: HTMLElement;
  private _terminal: Terminal;
  private _trailingNewline = false;
  private _lastWritePromise = Promise.resolve();
  private _listeners: IDisposable[] = [];
  public fullscreenEvent: JoelEvent<boolean> = new JoelEvent<boolean>(false);
  public activeEvent: JoelEvent<boolean> = new JoelEvent<boolean>(false);
  public clearEvent: JoelEvent<void> = new JoelEvent(undefined);
  public willResizeEvent = new JoelEvent<void>(undefined);
  public id: number;
  private _historyId: number;
  public empty = false;
  public cachedEvaluationResult = new Map<string, Promise<string>>();
  private _data: (string|Uint8Array)[] = [];
  constructor(
    public command: string,
    private _shellId: number,
  ) {
    this.id = ++lastEntryId;
    this.element = document.createElement('div');
    this.element.style.height = '0px';
    this.element.style.overflow = 'hidden';
    this._terminal = new Terminal({
      fontFamily: 'monaco',
      cols: size.cols,
      rows: size.rows,
      fontSize: 10,
      delegatesScrolling: true,
      theme: {
        black: '#3E3E3E',
        red: '#990000',
        green: '#00A600',
        yellow: '#999900',
        blue: '#0000B2',
        magenta: '#B200B2',
        cyan: '#00A6B2',
        white: '#BFBFBF',
        brightBlack: '#666666',
        brightRed: '#E50000',
        brightGreen: '#00D900',
        brightYellow: '#E5E500',
        brightBlue: '#0000FF',
        brightMagenta: '#E500E5',
        brightCyan: '#00E5E5',
        brightWhite: '#E5E5E5',
        foreground: '#F4F4F4',
        background: '#000000',
        selection: '#525252',
        cursor: '#606060',
      },
      rendererType: 'canvas',
    });
    this._terminal.open(this.element);
    
    this._listeners.push(this._terminal.onData(data => {
      window.electronAPI.sendMessage({
        method: 'sendRawInput',
        params: {
          shellId: this._shellId,
          input: data,
        },
      });
    }));
    this._listeners.push(this._terminal.buffer.onBufferChange(() => {
      this._willResize();
      this.fullscreenEvent.dispatch(this._terminal.buffer.active === this._terminal.buffer.alternate);
    }));
    this._listeners.push(this._terminal.onClear(() => {
      this.clearEvent.dispatch();
    }));
    this._terminal.onSelectionChange(() => {
      setSelection(() => this._terminal.getSelection());
    });
    this._terminal.onResize(() => {
      this._willResize();
    });
    let firstRender = true;
    this._terminal.onRender(() => {
      if (firstRender) {
        firstRender = false;
        this.updateSize();
      }
      this._willResize();
    });
    this._willResize();
  }

  _willResize() {
    this.willResizeEvent.dispatch();
    if (this._terminal.buffer.active === this._terminal.buffer.alternate) {
      this.element.style.removeProperty('height');
      this.element.style.padding = '4px';
    } else {
      this.element.style.height = this._terminal.element.getBoundingClientRect().height + 'px';
      this.element.style.removeProperty('padding');
    }
  }

  async addToHistory(shell: Shell) {
    if (!this.command)
      return;
    this._historyId = await addHistory(this.command);
    const pwd = await shell.cachedEvaluation('pwd');
    const home = await shell.cachedEvaluation('echo $HOME');
    const revName = await shell.cachedEvaluation('__git_ref_name');
    const dirtyState = await shell.cachedEvaluation('__is_git_dirty');
    const hash = await shell.cachedEvaluation('GIT_OPTIONAL_LOCKS=0 git rev-parse HEAD');
  
    await updateHistory(this._historyId, 'home', home);
    await updateHistory(this._historyId, 'pwd', pwd);
    await updateHistory(this._historyId, 'git_branch', revName);
    await updateHistory(this._historyId, 'git_dirty', dirtyState);
    await updateHistory(this._historyId, 'git_hash', hash);
  }

  addData(data: string|Uint8Array) {
    this._data.push(data);
    if (data.length !== 0)
      this._trailingNewline = typeof data === 'string' ? data.endsWith('\n') : data[data.length - 1] === '\n'.charCodeAt(0);
    this._lastWritePromise = new Promise(x => this._terminal.write(data, x));
  }
  async close() {
    await this._lastWritePromise;
    for (const listeners of this._listeners)
      listeners.dispose();
    if (this._trailingNewline) {
      this._terminal.deleteLastLine();
      
    } else {
      if (this._terminal.buffer.active === this._terminal.buffer.normal &&
        this._terminal.buffer.active.length === 1 &&
        this._terminal.buffer.active.getLine(0).translateToString(true) === '') {
        this.element.style.display = 'none';
        this.empty = true;
      }
      // TODO write some extra '%' character to show there was no trailing newline?
    }
    this._terminal.blur();
    this._terminal.disable();
    if (this._historyId) {
      await updateHistory(this._historyId, 'end', Date.now());
      let output = '';
      for (const data of this._data) {
        if (typeof data === 'string')
          output += data;
        else
          output += new TextDecoder().decode(data);
      }
      await updateHistory(this._historyId, 'output', output);
    }

  }
  updateSize() {
    this._terminal.resize(size.cols, size.rows);
  }
  focus() {
    this._terminal.focus();
  }
  cachedEvaluation(code: string): Promise<string> {
    if (!this.cachedEvaluationResult)
      return Promise.resolve(null);
    if (!this.cachedEvaluationResult.has(code))
      return Promise.resolve(null);
    return this.cachedEvaluationResult.get(code);
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
