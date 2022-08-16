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
      for (const column of this._columns) {
        const headerCell = document.createElement('th');
        headerCell.textContent = column.title;
        headerRow.append(headerCell);
      }
      this.table.append(header);
      const body = document.createElement('tbody');
      for (const item of this._items) {
        for (const column of this._columns) {
          const cell = document.createElement('td');
          cell.append(column.render(item.value));
          item.element.append(cell);
        }
        body.append(item.element);
      }
      this.table.append(body);
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