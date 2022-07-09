
export class Viewport<Item> {
  element: HTMLElement;
  private _wrapper: HTMLElement;
  private _items: Item[] = [];
  constructor(private _itemHeight: number, private _maxHeight: number, private _renderItem: (item: Item) => Element) {
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
    this._wrapper.textContent = '';
    this._items.forEach((item, index) => {
      if (!this._isInView(index))
        return;
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.top = index * this._itemHeight + 'px';
      div.style.left = '0';
      div.style.right = '0';
      div.style.height = this._itemHeight + 'px';
      div.append(this._renderItem(item));
      this._wrapper.appendChild(div);
    });
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