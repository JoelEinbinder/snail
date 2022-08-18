/// <reference path="../iframe/types.d.ts" />
import './datagrid.css';

export interface ColumnDelegate<T extends object> {
  render(item: T): Element;
  compare?(a: T, b: T): number;
  title: string;
}

class Column<T extends object> {
  shown = true;
  constructor(public delegate: ColumnDelegate<T>) {}
}
export class DataGrid<T extends object> {
  element = document.createElement('div');
  private table = document.createElement('table');
  private _items: DataGridItem<T>[] = [];
  private _sortedColumn: Column<T> | null = null;
  private _sortDirection = -1;
  private _columns: Column<T>[] = [];
  private _columnToHeaderCell = new WeakMap<Column<T>, HTMLTableCellElement>();
  constructor(columnDelegates: ColumnDelegate<T>[]) {
    this.element.classList.add('datagrid');
    this.element.append(this.table);
    this._columns = columnDelegates.map(delegate => new Column(delegate));
    this.render();
  }
  
  setItems(items: T[]) {
    this._items = items.map(item => new DataGridItem(this, item));
    this.render();
  }

  private render() {
    this.table.textContent = '';
    const header = document.createElement('thead');
    const headerRow = document.createElement('tr');
    header.append(headerRow);
    this._columnToHeaderCell = new WeakMap();
    for (const column of this._columns.filter(x => x.shown)) {
      const headerCell = document.createElement('th');
      headerCell.textContent = column.delegate.title;
      headerRow.append(headerCell);
      if (column.delegate.compare) {
        headerCell.onclick = () => {
          if (this._sortedColumn === column)
            this._sortDirection = -this._sortDirection;
          else
            this._sortDirection = -1;
          this._sortedColumn = column;
          this.render();
        };
        if (typeof d4 !== 'undefined') {
          headerCell.oncontextmenu = event => {
            d4.createContextMenu(this._columns.map(column => ({
              title: column.delegate.title,
              checked: column.shown,
              callback: () => {
                column.shown = !column.shown;
                this.render();
              }
            })))
            event.preventDefault();
          };
        }
      }
      this._columnToHeaderCell.set(column, headerCell);
    }
    this.table.append(header);
    const body = document.createElement('tbody');
    const sortedItems = [...this._items];
    if (this._sortedColumn) {
      sortedItems.sort((a, b) => {
        return this._sortDirection * this._sortedColumn!.delegate.compare!(a.value, b.value);
      })
    }
    for (const item of sortedItems) {
      item.element.textContent = '';
      for (const column of this._columns.filter(x => x.shown)) {
        const cell = document.createElement('td');
        cell.append(column.delegate.render(item.value));
        item.element.append(cell);
      }
      body.append(item.element);
    }
    this.table.append(body);
    this._updateSort();
  }

  private _updateSort() {
    for (const column of this._columns) {
      const headerCell = this._columnToHeaderCell.get(column);
      if (!headerCell)
        continue;
      headerCell.classList.toggle('sorted', this._sortedColumn === column);
      headerCell.classList.toggle('sort-asc', this._sortedColumn === column && this._sortDirection === 1);
    }
  }

  removeItem(item: DataGridItem<T>) {
    const index = this._items.indexOf(item);
    if (index === -1)
      return;
    item.element.remove();
    this._items.splice(index, 1);
  }
  updateItem(item: DataGridItem<T>) {

  }
}

class DataGridItem<T extends object> {
  element = document.createElement('tr');
  constructor(private _parent: DataGrid<T>, public value: T) {
    
  }
  remove() {
    this._parent.removeItem(this);
  }
  update() {
    this._parent.updateItem(this);
  }
}