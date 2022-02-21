import { Terminal, IDisposable } from "xterm";
import { JoelEvent } from "./JoelEvent";
import type { LogItem } from "./LogView";
import { setSelection } from './selection';

let lastTerminalBlock: TerminalBlock = null;
window.electronAPI.onEvent('data', ({shellId, data}) => {
  // TODO have this say block ID, not shell ID. and then find the correct one.
  if (lastTerminalBlock)
    lastTerminalBlock.addData(data);
});


export class TerminalBlock implements LogItem {
  public willResizeEvent = new JoelEvent<void>(undefined);
  public activeEvent = new JoelEvent<boolean>(false);
  public dispose: () => void;

  public fullscreenEvent: JoelEvent<boolean> = new JoelEvent<boolean>(false);
  public clearEvent: JoelEvent<void> = new JoelEvent(undefined);

  private _terminal: Terminal;
  private element: HTMLDivElement;
  private _listeners: IDisposable[] = [];
  private _data: (string|Uint8Array)[] = [];
  private _trailingNewline = false;
  private _lastWritePromise = Promise.resolve();
  public empty = true;
  constructor(private _size: JoelEvent<{cols: number, rows: number}>, sendInput: (data: string) => void) {

    this.element = document.createElement('div');
    this.element.style.height = '0px';
    this.element.style.overflow = 'hidden';
    this._terminal = new Terminal({
      fontFamily: 'monaco',
      cols: this._size.current.cols,
      rows: this._size.current.rows,
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
      sendInput(data);
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
        windowResize(this._size.current);
      }
      this._willResize();
    });
    this._willResize();
    const windowResize = (size: {rows: number, cols: number}) => {
      this._terminal.resize(size.cols, size.rows);
    };
    this._size.on(windowResize);
    this.dispose = () => {
      this._size.off(windowResize);
    }
    lastTerminalBlock = this;
  }
  focus(): void {
    this._terminal.focus();
  }
  render(): Element {
    return this.element;
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

  addData(data: string|Uint8Array) {
    this.empty = false;
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
  }

  allData() {
    return this._data;
  }
}