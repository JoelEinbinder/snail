import './logBookView.css';
const ROW_HEIGHT = 20;
const BATCH_SIZE = 100;
class LogGrid {
  public element = document.createElement('div');
  private _scroller = document.createElement('div');
  private _abortUpadte?: () => void;
  private _rows: Row[] = [];
  private _cachedQueries = new Map<number, Promise<any[]>>();
  constructor(private _query: (sql: string, params?: any) => Promise<any[]>) {
    this.element.classList.add('grid');
    this._scroller.classList.add('scroller');
    this.element.appendChild(this._scroller);
    this.setFilter(null);
    this.element.addEventListener('scroll', () => this._renderViewport());
    const observer = new ResizeObserver(() => this._renderViewport());
    observer.observe(this.element);
  }

  async setFilter(filter: string | null) {
    this._abortUpadte?.();
    const abort = new AbortController();
    this._abortUpadte = () => abort.abort();
    const WHERE = filter ? `WHERE command LIKE ?` : '';
    const args = filter ? [filter] : [];
    const query = await this._query(`SELECT COUNT() FROM history ${WHERE}`, args);
    const getOrCacheQuery = (index: number) => {
      if (!this._cachedQueries.has(index))
        this._cachedQueries.set(index, this._query(`SELECT command FROM history ${WHERE} LIMIT ? OFFSET ?`, [...args, BATCH_SIZE, index]));
      return this._cachedQueries.get(index)!;
    };
    this._cachedQueries.clear();
    if (!query) {
      this._scroller.textContent = 'Query failed';
      return;
    };
    await getOrCacheQuery(0);
    this._scroller.textContent = '';
    const count = query[0]['COUNT()'];
    if (abort.signal.aborted) return;
    this._rows = [];
    for (let i = 0; i < count; i++) {
      const row = new Row(i, async () => {
        const index = Math.floor(i / BATCH_SIZE) * BATCH_SIZE;
        return (await getOrCacheQuery(index))[i % BATCH_SIZE];
      });
      this._scroller.appendChild(row.element);
      this._rows.push(row);
    }
    this._renderViewport();
  }

  private _renderViewport() {
    const scrollTop = this.element.scrollTop;
    const first = Math.floor(scrollTop / ROW_HEIGHT);
    const last = Math.ceil((scrollTop + this.element.clientHeight) / ROW_HEIGHT);
    for (let i = first; i < last; i++)
      this._rows[i]?.render();
  }
}

class Row {
  public element = document.createElement('div');
  private _rendered = false;
  constructor(private _index: number, private _getInfo: () => Promise<any>) {
    this.element.classList.add('row');
    this.element.textContent = '…';
  }
  async render() {
    if (this._rendered) return;
    this._rendered = true;
    const data = await this._getInfo();
    this.element.textContent = data.command;
  }
}

export class LogBookView {
  element = document.createElement('div');
  private _filter: LogFilter;
  constructor(private _query: (sql: string, params?: any) => Promise<any[]>) {
    this.element.classList.add('logbook');
    this._filter = new LogFilter(filter => grid.setFilter(`%${filter}%`));
    const grid = new LogGrid(_query);
    this.element.append(this._filter.element, grid.element);
  }

  focus() {
    this._filter.focus();
  }
}

class LogFilter {
  public element = document.createElement('div');
  private _input = document.createElement('input');
  constructor(private _onChange: (filter: string) => void) {
    this.element.classList.add('log-filter');
    this.element.appendChild(this._input);
    this._input.addEventListener('input', () => this._onChange(this._input.value));
  }

  focus() {
    this._input.focus();
  }
}
