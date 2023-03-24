import { Terminal, IDisposable } from "xterm";
import type { AntiFlicker } from "./AntiFlicker";
import { font } from "./font";
import { JoelEvent } from "../slug/cdp-ui/JoelEvent";
import type { LogItem } from "./LogView";
import { setSelection } from './selection';
import { titleThrottle } from "./title";
import { RendererAddon } from "./terminal/RendererAddon";

export type TerminalBlockDelegate = {
  size: JoelEvent<{cols: number, rows: number}>;
  sendInput: (data: string) => void;
  antiFlicker?: AntiFlicker;
}

export class TerminalBlock implements LogItem {
  public willResizeEvent = new JoelEvent<void>(undefined);
  public dispose: () => void;
  public cleared = false;

  public fullscreenEvent: JoelEvent<boolean> = new JoelEvent<boolean>(false);
  public clearEvent: JoelEvent<void> = new JoelEvent(undefined);

  private _terminal: Terminal;
  private element: HTMLDivElement;
  private _listeners: IDisposable[] = [];
  private _data: (string|Uint8Array)[] = [];
  private _trailingNewline = false;
  private _lastWritePromise = Promise.resolve();
  private _addon = new RendererAddon();
  public empty = true;
  private _closed = false;
  constructor(delegate: TerminalBlockDelegate) {

    this.element = document.createElement('div');
    this.element.style.height = '0px';
    this.element.style.overflow = 'hidden';
    this._terminal = new Terminal({
      fontFamily: font.current.family,
      cols: delegate.size.current.cols,
      rows: delegate.size.current.rows,
      fontSize: font.current.size,
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
        background: 'transparent',
        selection: '#525252',
        cursor: '#606060',
      },
      fontWeightBold: 'normal',
      allowTransparency: true,
      rendererType: 'canvas',
    });
    this._terminal.open(this.element);
    this._terminal.loadAddon(this._addon);
    
    this._listeners.push(this._terminal.onData(data => {
      delegate.sendInput(data);
    }));
    this._listeners.push(this._terminal.buffer.onBufferChange(() => {
      this._willResize();
      this.fullscreenEvent.dispatch(this._terminal.buffer.active === this._terminal.buffer.alternate);
    }));
    this._listeners.push(this._terminal.onTitleChange(title => {
      titleThrottle.update(title);
    }));
    this._listeners.push(this._terminal.onClear(() => {
      this.cleared = true;
      this.clearEvent.dispatch();
    }));
    this._terminal.onSelectionChange(() => {
      setSelection(() => this._terminal.getSelection());
    });
    this._terminal.onResize(() => {
      this._willResize();
    });
    
    font.on(this._fontChanged);
    let firstRender = true;
    this._terminal.onRender(() => {
      if (firstRender) {
        firstRender = false;
        windowResize(delegate.size.current);
      }
      this._willResize();
    });
    this._willResize();
    const windowResize = (size: {rows: number, cols: number}) => {
      this._terminal.resize(size.cols, size.rows);
    };
    delegate.size.on(windowResize);
    this.dispose = () => {
      delegate.size.off(windowResize);
      this._terminal.dispose();
    }
  }
  focus(): void {
    this._terminal.focus();
  }
  render(): Element {
    if (this.empty && this._closed)
      return null;
    return this.element;
  }

  _fontChanged = () => {
    this._willResize();
    this._terminal.options.fontFamily = font.current.family;
    this._terminal.options.fontSize = font.current.size;
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

  async waitForLineForTest(regex: RegExp, signal?: AbortSignal) {
    let resolve: () => void;
    const promise = new Promise<void>(x => resolve = x);
    const callback = () => {
      const buffer = this._terminal.buffer.active;
      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (regex.test(line.translateToString(true))) {
          resolve();
          break;
        }
      }
    }
    const dispose = this._terminal.onRender(callback);
    signal?.addEventListener('abort', () => dispose.dispose(), { once: true});
    callback();
    await promise;
    dispose.dispose();
  }

  async close() {
    await this._lastWritePromise;

    for (const listeners of this._listeners)
      listeners.dispose();
    font.off(this._fontChanged);
    const buffer = this._terminal.buffer.active;
    const bufferSize = buffer.length - this._addon.bottomBlankRows;
    if (bufferSize <= 1 &&
      buffer.getLine(0).translateToString(true) === '') {
      this.element.style.display = 'none';
      this.element.remove();
      this.dispose();
      this.empty = true;
    } else if (!this._trailingNewline) {
      // TODO write some extra '%' character to show there was no trailing newline?
    }
    if (this._terminal.buffer.active === this._terminal.buffer.alternate)
      this.fullscreenEvent.dispatch(false);
    this._closed = true;
    this._terminal.blur();
    this._terminal.disable();
  }

  allData() {
    return this._data;
  }

  async serializeForTest(): Promise<any> {
    if (!this.element.isConnected)
      return null;
    const buffer = this._terminal.buffer.active;
    const lines = [];
    const bufferSize = buffer.length - this._addon.bottomBlankRows;
    for (let i = 0; i < bufferSize; i++)
      lines.push(buffer.getLine(i).translateToString(true));
    return lines.join('\n');
  }

  isFullscreen(): boolean {
    return this.fullscreenEvent.current;
  }
}