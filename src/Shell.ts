import {Terminal} from 'xterm';
import { WebglAddon } from '../xterm.js/addons/xterm-addon-webgl/';
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
    return shell;
  }
  async runCommand(command: string) {
    const entry = new Entry(command);
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
}
export class Entry {
  element: HTMLElement;
  private _terminal: Terminal;
  private _trailingNewline = false;
  private _lastWritePromise = Promise.resolve();
  constructor(
    public command: string,
  ) {
    this.element = document.createElement('div');
    let rows = 0;
    this._terminal = new Terminal({
      rows: 0,
      fontFamily: 'monaco',
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
  }

  addData(data: string|Uint8Array) {
    if (data.length !== 0)
      this._trailingNewline = typeof data === 'string' ? data.endsWith('\n') : data[data.length - 1] === '\n'.charCodeAt(0);
    this._lastWritePromise = new Promise(x => this._terminal.write(data, x));
  }
  async close() {
    await this._lastWritePromise;
    if (this._trailingNewline)
      this._terminal.deleteLastLine();
    else {
      // TODO write some extra '%' character to show there was no trailing newline?
    }
    this._terminal.blur();
    this._terminal.disable();
  }
}
