import './gridPane.css';

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlockDelegate {
  close(): void;
  split(newBlock: Block, direction: 'horizontal' | 'vertical'): void;
  replaceWith(block: Block): void
}

export interface Block {
  updatePosition(rect: Rect): void;
  blockDelegate?: BlockDelegate;
}

class RootBlock {
  element = document.createElement('div');
  block?: Block = null;
  constructor() {
    this.element.classList.add('root-block');
    window.addEventListener('resize', () => {
      this.block?.updatePosition(this.element.getBoundingClientRect().toJSON());
    });
    document.body.append(this.element);
  }
  setBlock(block: Block) {
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
        }
      }
    }
    this._layout();
  }
  private _layout() {
    this.block?.updatePosition(this.element.getBoundingClientRect());
  }
}

export const rootBlock = new RootBlock();

class SplitBlock implements Block {
  public blockDelegate?: BlockDelegate;
  private _rect?: Rect;
  private _ratio = 0.5;
  private _dividerElement = document.createElement('div');
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
    this._rootElement.append(this._dividerElement);
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
        this.setBlock(index, newBlock);
      }
    }
    this._layout();
  }

  updatePosition(rect: Rect): void {
    this._rect = rect;
    this._layout();
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