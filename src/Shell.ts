import {Terminal, IDisposable} from 'xterm';
import 'xterm/css/xterm.css';
import { JoelEvent } from './JoelEvent';

window.electronAPI.onEvent(event => {
  const {method, params} = event;
  switch (method) {
    case 'data':
      const shell = shells.get(params.shellId);
      shell.log[shell.log.length - 1].addData(params.data);
      break;
  }
});

const shells = new Map<number, Shell>();

const size = {
  rows: 0,
  cols: 0,
}
function updateSize() {
  const {width, height} = measureChar();
  size.cols = Math.floor(window.innerWidth / width);
  size.rows = Math.floor(window.innerHeight / height);
  for (const shell of shells.values())
    shell.updateSize();
}
window.addEventListener('resize', updateSize);
updateSize();

export class Shell {
  log: Entry[] = [];
  updated = new JoelEvent(0);
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
    this.log.push(entry);
    this.updated.dispatch(this.updated.current + 1);
    await window.electronAPI.sendMessage({
      method: 'runCommand',
      params: {
        shellId: this._shellId,
        command,
      },
    });
    await entry.close();
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
}
export class Entry {
  element: HTMLElement;
  private _terminal: Terminal;
  private _trailingNewline = false;
  private _lastWritePromise = Promise.resolve();
  private _listeners: IDisposable[] = [];
  constructor(
    public command: string,
    private _shellId: number,
  ) {
    this.element = document.createElement('div');
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
  }

  addData(data: string|Uint8Array) {
    if (data.length !== 0)
      this._trailingNewline = typeof data === 'string' ? data.endsWith('\n') : data[data.length - 1] === '\n'.charCodeAt(0);
    this._lastWritePromise = new Promise(x => this._terminal.write(data, x));
  }
  async close() {
    for (const listeners of this._listeners)
      listeners.dispose();
    await this._lastWritePromise;
    if (this._trailingNewline)
      this._terminal.deleteLastLine();
    else {
      // TODO write some extra '%' character to show there was no trailing newline?
    }
    this._terminal.blur();
    this._terminal.disable();
  }
  updateSize() {
    this._terminal.resize(size.cols, size.rows);
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
