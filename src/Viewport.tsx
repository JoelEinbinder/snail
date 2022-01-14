import React from 'react';
import { render } from 'react-dom';

export class Viewport<Item> {
  element: HTMLElement;
  private _wrapper: HTMLElement;
  private _items: Item[] = [];
  constructor(private _itemHeight: number, private _maxHeight: number, private _renderItem: (item: Item) => React.ReactNode) {
    this.element = document.createElement('div');
    this.element.className = 'scroller';
    this.element.style.overflowY = 'scroll';
    this.element.style.position = 'relative';
    this.element.style.maxHeight = this._maxHeight + 'px';
    this._wrapper = document.createElement('div');
    this.element.appendChild(this._wrapper);
    this.element.addEventListener('scroll', () => {
      this._refresh();
    });
    this._refresh();
  }

  _isInView(index: number) {
    const scrollTop = this.element.scrollTop;
    const itemTop = index * this._itemHeight;
    const itemBottom = itemTop + this._itemHeight;
    return itemBottom >= scrollTop && itemTop <= scrollTop + this._maxHeight;
  }

  _refresh() {
    this._wrapper.style.height = this._itemHeight * this._items.length + 'px';
    render(<>
      {this._items.map((item, index) => {
        // TODO maybe put keys on suggestions for effeciency?
        return this._isInView(index) && <div style={{position: 'absolute', height: this._itemHeight, top: index * this._itemHeight, left:0, right: 0}} key={index}>{this._renderItem(item)}</div>;
      })}
    </>, this._wrapper);
  }

  setItems(items: Item[]) {
    this._items = items;
    this._refresh();
  }

  isItemFullyVisible(item: Item) {
    const index = this._items.indexOf(item);
    if (index === -1)
      return false;
    const scrollTop = this.element.scrollTop;
    const itemTop = index * this._itemHeight;
    const itemBottom = itemTop + this._itemHeight;
    return itemTop >= scrollTop && itemBottom <= scrollTop + this._maxHeight;
  }

  showItem(item: Item, direction: 'up'|'down') {
    const index = this._items.indexOf(item);
    if (index === -1)
      return;
    const scrollTop = this.element.scrollTop;
    const scrollBottom = this.element.scrollTop + this._maxHeight;
    const itemTop = index * this._itemHeight;
    const itemBottom = itemTop + this._itemHeight;
    if (itemTop > scrollTop && itemBottom < scrollBottom)
      return;
    if (direction === 'up')
      this.element.scrollTop = itemTop;
    else
      this.element.scrollTop = itemBottom - this._maxHeight;
  }
}