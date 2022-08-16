import './datagrid.css';

export interface ColumnDelegate<T extends object> {
  render(item: T): Element;
  compare?(a: T, b: T): number;
  title: string;
}

export class DataGrid<T extends object> {
  element = document.createElement('div');
  private table = document.createElement('table');
  private _items: DataGridItem<T>[] = [];
  private _sortedColumn: ColumnDelegate<T> | null = null;
  private _sortDirection = -1;
  private _columnToHeaderCell = new WeakMap<ColumnDelegate<T>, HTMLTableCellElement>();
  constructor(private _columns: ColumnDelegate<T>[]) {
    this.element.classList.add('datagrid');
    this.element.append(this.table);
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
    for (const column of this._columns) {
      const headerCell = document.createElement('th');
      headerCell.textContent = column.title;
      headerRow.append(headerCell);
      if (column.compare) {
        headerCell.onclick = () => {
          if (this._sortedColumn === column)
            this._sortDirection = -this._sortDirection;
          else
            this._sortDirection = -1;
          this._sortedColumn = column;
          this.render();
        };
      }
      this._columnToHeaderCell.set(column, headerCell);
    }
    this.table.append(header);
    const body = document.createElement('tbody');
    const sortedItems = [...this._items];
    if (this._sortedColumn) {
      sortedItems.sort((a, b) => {
        return this._sortDirection * this._sortedColumn!.compare!(a.value, b.value);
      })
    }
    for (const item of sortedItems) {
      item.element.textContent = '';
      for (const column of this._columns) {
        const cell = document.createElement('td');
        cell.append(column.render(item.value));
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