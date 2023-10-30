/// <reference path="../iframe/types.d.ts" />
import './datagrid.css';

export interface ColumnDelegate<T extends object> {
  render(item: T): Element;
  compare?(a: T, b: T): number;
  title: string;
  defaultHidden?: boolean;
  alwaysVisible?: boolean;
  defaultSortDirection?: number;
}

class Column<T extends object> {
  shown: boolean;
  constructor(public delegate: ColumnDelegate<T>) {
    this.shown = !delegate.defaultHidden || !!delegate.alwaysVisible;
  }
}

export interface DataGridDelegate {
  saveItem(key: string, value: any): void;
  loadItem(key: string): Promise<any>;
}

export class DataGrid<T extends object> {
  element = document.createElement('div');
  private table = document.createElement('table');
  private _items: DataGridItem<T>[] = [];
  private _sortedColumn: Column<T> | null = null;
  private _sortDirection = -1;
  private _columns: Column<T>[] = [];
  private _columnToHeaderCell = new WeakMap<Column<T>, HTMLTableCellElement>();
  constructor(columnDelegates: ColumnDelegate<T>[], private _delegate: DataGridDelegate) {
    this.element.classList.add('datagrid');
    this.element.append(this.table);
    this._columns = columnDelegates.map(delegate => new Column(delegate));
    for (const column of this._columns) {
      if (!column.delegate.defaultSortDirection)
        continue;
      this._sortedColumn = column;
      this._sortDirection = column.delegate.defaultSortDirection;
      break;
    }
  }

  async loadAllData() {
    await Promise.all([...this._columns.map(async column => {
      if (column.delegate.alwaysVisible)
        return;
      const hidden = await this._delegate.loadItem(`datagrid.column.hidden.${column.delegate.title}`);
      if (hidden === undefined)
        return;
      column.shown = !hidden;
    }),
    this._delegate.loadItem(`datagrid.sort.column`).then(sort => {
      if (!sort)
        return;
      const {title, direction} = sort;
      const column = this._columns.find(x => x.delegate.title === title);
      if (!column)
        return;
      this._sortedColumn = column;
      this._sortDirection = direction;
    })]);
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
          this._delegate.saveItem(`datagrid.sort.column`, {title: column.delegate.title, direction: this._sortDirection});
          this.render();
        };
        if (typeof snail !== 'undefined') {
          headerCell.oncontextmenu = event => {
            snail.createContextMenu(this._columns.map(column => ({
              title: column.delegate.title,
              checked: column.shown,
              callback: column.delegate.alwaysVisible ? undefined : () => {
                column.shown = !column.shown;
                this._delegate.saveItem(`datagrid.column.hidden.${column.delegate.title}`, !column.shown);
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