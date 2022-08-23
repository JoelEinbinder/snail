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
  private _dividerElement = document.createElement('div');
  constructor(private _blocks: [Block, Block], private _type: 'horizontal' | 'vertical', private _rootElement: HTMLElement) {
    for (let i = 0; i < this._blocks.length; i++)
      this.setBlock(i, this._blocks[i]);
    this._dividerElement.classList.add('divider');
    this._dividerElement.classList.add(this._type);
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
        width: rect.width / 2,
        height: rect.height
      });
      this._blocks[1].updatePosition({
        x: rect.x + rect.width / 2,
        y: rect.y,
        width: rect.width / 2,
        height: rect.height
      });
      this._dividerElement.style.left = (rect.x + rect.width / 2) + 'px';
      this._dividerElement.style.top = rect.y + 'px';
      this._dividerElement.style.height = rect.height + 'px';
    } else {
      this._blocks[0].updatePosition({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height / 2
      });
      this._blocks[1].updatePosition({
        x: rect.x,
        y: rect.y + rect.height / 2,
        width: rect.width,
        height: rect.height / 2
      });
      this._dividerElement.style.top = (rect.y + rect.height / 2) + 'px';
      this._dividerElement.style.left = rect.x + 'px';
      this._dividerElement.style.width = rect.width + 'px';
    }
  }
}