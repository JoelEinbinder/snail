import { QuickPickProvider } from './QuickPick';
import type { Action } from './actions';
import { font } from './font';
import './gridPane.css';
import { host } from './host';

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlockDelegate {
  close(): void;
  split(newBlock: Block, direction: 'horizontal' | 'vertical'): void;
  replaceWith(block: Block): void;
  titleUpdated(): void;
}

export interface Block {
  updatePosition(rect: Rect): void;
  hide(): void;
  show(): void;
  focus(): void;
  hasFocus(): boolean;
  blockDelegate?: BlockDelegate;
  serializeForTest(): Promise<any>;
  title(): string;
  close(): void;
  actions(): Action[];
  asyncActions(): Promise<Action[]>;
  quickPicks(): Promise<QuickPickProvider[]>;
}
class RootBlock {
  element = document.createElement('div');
  block?: Block = null;
  constructor() {
    this.element.classList.add('root-block');
    window.addEventListener('resize', () => {
      this.block?.updatePosition(this.element.getBoundingClientRect().toJSON());
    });
    font.on(() => {
      this.block?.updatePosition(this.element.getBoundingClientRect().toJSON());
    });
    document.body.append(this.element);
    document.body.addEventListener('keydown', event => {
      if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey)
        return;
      const element = document.activeElement as HTMLElement;
      if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT' || element.isContentEditable)
        return;
      if (event.defaultPrevented)
        return;
      this.block?.focus();
    });
  }
  setBlock(block: Block) {
    const hadFocus = this.block?.hasFocus();
    this.block?.hide();
    this.block = block;
    if (block) {
      block.blockDelegate = {
        close: () => {
          this.setBlock(null);
        },
        split: (newBlock, direction) => {
          const splitBlock = new SplitBlock([block, newBlock], direction, this.element);
          this.setBlock(splitBlock);
        },
        replaceWith: newBlock => {
          this.setBlock(newBlock);
        },
        titleUpdated: () => {
          document.title = block.title();
        },
      }
    } else {
      host.sendMessage({ method: 'close' });
    }
    block?.show();
    this._layout();
    if (hadFocus)
      block?.focus();
  }
  private _layout() {
    this.block?.updatePosition(this.element.getBoundingClientRect());
  }

  actions(): Action[] {
    return this.block?.actions() || [];
  }

  async asyncActions(): Promise<Action[]> {
    return this.block?.asyncActions() || [];
  }

  async quickPicks(): Promise<QuickPickProvider[]> {
    return this.block?.quickPicks?.();
  }

  async serializeForTest() {
    return this.block ? this.block.serializeForTest() : null;
  }
}

export const rootBlock = new RootBlock();

export class SplitBlock implements Block {
  public blockDelegate?: BlockDelegate;
  private _rect?: Rect;
  private _ratio = 0.5;
  private _dividerElement = document.createElement('div');
  private _showing = false;
  constructor(private _blocks: [Block, Block], private _type: 'horizontal' | 'vertical', private _rootElement: HTMLElement) {
    for (let i = 0; i < this._blocks.length; i++)
      this.setBlock(i, this._blocks[i]);
    this._dividerElement.classList.add('divider');
    this._dividerElement.classList.add(this._type);
    this._dividerElement.addEventListener('mousedown', event => {
      if (event.defaultPrevented || event.button !== 0)
        return;
      document.body.style.cursor = this._type === 'horizontal' ? 'col-resize' : 'row-resize';
      this._rootElement.style.pointerEvents = 'none';
      tragDrag(event => {
        this._ratio = this._type === 'horizontal' ? event.x / this._rect!.width : event.y / this._rect!.height;
        this._ratio = Math.max(0.1, Math.min(0.9, this._ratio));
        this._layout();
      }, () => {
        document.body.style.removeProperty('cursor');
        this._rootElement.style.removeProperty('pointer-events');
      });
      event.preventDefault();
    });
  }
  close(): void {
    for (const block of this._blocks)
      block.close();
  }
  hide(): void {
    this._showing = false;
    this._dividerElement.remove();
    for (const block of this._blocks)
      block.hide();
  }
  show(): void {
    this._showing = true;
    this._rootElement.append(this._dividerElement);
    for (const block of this._blocks)
      block.show();
  }

  setBlock(index: number, block: Block) {
    this._blocks[index] = block;
    block.blockDelegate = {
      close: () => {
        this.blockDelegate!.replaceWith(this._blocks[1-index]);
        this._dispose();
      },
      split: (newBlock, direction) => {
        this.setBlock(index, new SplitBlock([block, newBlock], direction, this._rootElement));
      },
      replaceWith: newBlock => {
        const hadFocus = block.hasFocus();
        this.setBlock(index, newBlock);
        if (hadFocus)
          newBlock.focus();
      },
      titleUpdated: () => {
        this.blockDelegate?.titleUpdated();
      },
    }
    if (this._showing)
      block.show();
    this._layout();
  }

  title() {
    return this._blocks.find(b => b.hasFocus())?.title() || this._blocks[0]?.title();
  }

  hasFocus(): boolean {
      return this._blocks.some(x => x.hasFocus());
  }

  focus(): void {
    this._blocks[0].focus();
  }

  updatePosition(rect: Rect): void {
    this._rect = rect;
    this._layout();
  }

  actions() {
    return this._blocks.find(x => x.hasFocus())?.actions() || [];
  }

  async asyncActions() {
    return this._blocks.find(x => x.hasFocus())?.asyncActions?.() || [];
  }

  private _dispose() {
    this._dividerElement.remove();
  }

  private _layout() {
    const rect = this._rect;
    if (!rect)
      return;
    if (this._type === 'horizontal') {
      this._blocks[0].updatePosition({
        x: rect.x,
        y: rect.y,
        width: rect.width * this._ratio,
        height: rect.height
      });
      this._blocks[1].updatePosition({
        x: rect.x + rect.width * this._ratio,
        y: rect.y,
        width: rect.width * (1 - this._ratio),
        height: rect.height
      });
      this._dividerElement.style.left = (rect.x + rect.width * this._ratio) + 'px';
      this._dividerElement.style.top = rect.y + 'px';
      this._dividerElement.style.height = rect.height + 'px';
    } else {
      this._blocks[0].updatePosition({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height * this._ratio
      });
      this._blocks[1].updatePosition({
        x: rect.x,
        y: rect.y + rect.height * this._ratio,
        width: rect.width,
        height: rect.height * (1 - this._ratio)
      });
      this._dividerElement.style.top = (rect.y + rect.height * this._ratio) + 'px';
      this._dividerElement.style.left = rect.x + 'px';
      this._dividerElement.style.width = rect.width + 'px';
    }
  }

  async serializeForTest() {
    return {
      type: 'split-' + this._type,
      ratio: this._ratio,
      children: await Promise.all(this._blocks.map(x => x.serializeForTest())),
    };
  }

  async quickPicks(): Promise<QuickPickProvider[]> {
    return (await Promise.all(this._blocks.map(block => block.quickPicks()))).flat();
  }
}

function tragDrag(updateMouse: (event: MouseEvent) => void, stop?: (event: MouseEvent) => void) {
  // We have to listen on the window so that you can select outside the bounds
  const mousemove = (event: MouseEvent) => {
    updateMouse(event);
  };
  const mouseup = (event: MouseEvent) => {
    window.removeEventListener('mousemove', mousemove, true);
    window.removeEventListener('mouseup', mouseup, true);
    stop?.(event);
  };
  window.addEventListener('mousemove', mousemove, true);
  window.addEventListener('mouseup', mouseup, true);
}
