import { Terminal, IDisposable } from "xterm";
import type { AntiFlicker } from "./AntiFlicker";
import { host } from "./host";
import { IFrameBlock } from "./IFrameBlock";
import { JoelEvent } from "./JoelEvent";
import type { LogItem } from "./LogView";
import type { ProgressBlock } from "./ProgressBlock";
import { setSelection } from './selection';
import { titleThrottle } from "./UIThrottle";

let lastTerminalBlock: TerminalBlock = null;
host.onEvent('data', ({shellId, data}) => {
  // TODO have this say block ID, not shell ID. and then find the correct one.
  if (lastTerminalBlock)
    lastTerminalBlock.addData(data);
});

export type TerminalBlockDelegate = {
  size: JoelEvent<{cols: number, rows: number}>;
  shellId: number;
  sendInput: (data: string) => void;
  antiFlicker?: AntiFlicker;
  progressBlock: ProgressBlock;
}

export class TerminalBlock implements LogItem {
  public willResizeEvent = new JoelEvent<void>(undefined);
  public dispose: () => void;
  public cleared = false;

  public fullscreenEvent: JoelEvent<boolean> = new JoelEvent<boolean>(false);
  public clearEvent: JoelEvent<void> = new JoelEvent(undefined);

  private _terminal: Terminal;
  private element: HTMLDivElement;
  private _iframeBlock: IFrameBlock = null;
  private _listeners: IDisposable[] = [];
  private _data: (string|Uint8Array)[] = [];
  private _trailingNewline = false;
  private _lastWritePromise = Promise.resolve();
  private _delegate: TerminalBlockDelegate;
  public empty = true;
  private _closed = false;
  constructor(delegate: TerminalBlockDelegate) {
    this._delegate = delegate;

    this.element = document.createElement('div');
    this.element.style.height = '0px';
    this.element.style.overflow = 'hidden';
    this._terminal = new Terminal({
      fontFamily: 'monaco',
      cols: delegate.size.current.cols,
      rows: delegate.size.current.rows,
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
        background: 'transparent',
        selection: '#525252',
        cursor: '#606060',
      },
      fontWeightBold: 'normal',
      allowTransparency: true,
      rendererType: 'canvas',
    });
    this._terminal.setHTMLDelegate({
      start: (data: string) => {
        function hasFocus(element: Element) {
          let active = document.activeElement;
          while (active) {
            if (active === element)
              return true;
              active = active.parentElement;
          }
          return false;
        }
        const hadFocus = hasFocus(this.element);
        this._iframeBlock = new IFrameBlock(data, delegate.shellId, this.willResizeEvent, delegate.antiFlicker);
        this.element.replaceWith(this._iframeBlock.iframe);
        if (hadFocus)
          this.focus();
      },
      end: () =>{
        this._iframeBlock.iframe.replaceWith(this.element);
        this._iframeBlock = null;
      },
      message: (data: string) => {
        this._iframeBlock.message(data);
      },
      setProgress: (progress) => {
        delegate.progressBlock.setProgress(progress);
      }
    })
    this._terminal.open(this.element);
    
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
    }
    lastTerminalBlock = this;
  }
  focus(): void {
    if (this._iframeBlock)
      this._iframeBlock.iframe.focus();
    else
      this._terminal.focus();
  }
  render(): Element {
    if (this.empty && this._closed)
      return null;
    if (this._iframeBlock)
      return this._iframeBlock.iframe;
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
    this._delegate.progressBlock.deactivate();

    for (const listeners of this._listeners)
      listeners.dispose();
    if (this._trailingNewline) {
      this._terminal.deleteLastLine();
      
    } else {
      const buffer = this._terminal.buffer.active;
      if (buffer === this._terminal.buffer.normal &&
        buffer.length === 1 &&
        buffer.getLine(0).translateToString(true) === '') {
        this.element.style.display = 'none';
        this.element.remove();
        this.empty = true;
      } else if (buffer === this._terminal.buffer.normal && buffer.getLine(buffer.length - 1).translateToString(true) === '') {
        this._terminal.deleteLastLine();
      }
      // TODO write some extra '%' character to show there was no trailing newline?
    }
    this._closed = true;
    this._terminal.blur();
    this._terminal.disable();
  }

  allData() {
    return this._data;
  }
}