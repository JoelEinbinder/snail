import { AntiFlicker } from './AntiFlicker';
import './find.css';

import type { FindParams } from '../slug/sdk/web';
export type { FindParams } from '../slug/sdk/web';

export class Find {
  private _element = document.createElement('div');
  private _input = document.createElement('input');
  private _countElement = document.createElement('span');
  private _index: number|null = null;
  private _count = 0;
  private _findUpdateNumber = 0;
  constructor(private _findable: Findable, private _restoreFocus: () => void) {
    this._element.classList.add('find');
    this._countElement.classList.add('find-count');
    this._element.append(this._input, this._countElement);
    this._input.addEventListener('keydown', event => {
      if (event.key === 'Escape')
        this.close();
      else if (event.key === 'Enter' && !event.shiftKey)
        this._next();
      else if (event.key === 'Enter' && event.shiftKey)
        this._previous();
      else
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
    });
    this._input.addEventListener('input', () => this._update());
    this._render();
  }

  _update() {
    if (!this._input.value) {
      this._findable.setFind?.(null);
      this._setCount(0);
      return;
    }
    this._findUpdateNumber++;
    const myFindNumber = this._findUpdateNumber;
    this._count = 0;
    this._findable.setFind?.({
      regex: new RegExp(this._input.value, 'gi'),
      report: matches => {
        if (this._findUpdateNumber !== myFindNumber)
          return;
        this._setCount(matches);
      }
    });
  }

  _setCount(count: number) {
    this._count = count;
    this._render();
  }

  _render() {
    if (!this._count) {
      this._countElement.textContent = 'No results';
      return;
    }
    this._countElement.textContent = `${this._index === null ? '?' : (this._index + 1)} of ${this._count}`;
  }

  _next() {
    if (this._index === null)
      this._index = 0;
    else
      this._index ++;
    this._index %= this._count;
    this._render();
  }
  

  _previous() {
    if (this._index === null)
      this._index = this._count - 1;
    else
      this._index --;
    this._index = (this._index + this._count) % this._count;
    this._render();
  }

  close() {
    if (this._input.ownerDocument.activeElement === this._input)
      this._restoreFocus();
    this._findable.setFind?.(null);
    this._element.remove();
  }

  open(parent: Element) {
    parent.append(this._element);
    this.focus();
    this._update();
  }

  focus() {
    this._input.focus();
    this._input.select();
  }
}
export interface Findable {
  setFind(params: FindParams|null): void;
}

export class FindableList<T extends Findable> implements Findable {
  private _findParams: FindParams|null = null;
  private _findables: T[] = [];
  private _matchesCount = 0;
  private _matchesAtIndex = [];
  constructor() {
  }
  async setFind(params: FindParams|null) {
    this._findParams = params;
    this._matchesCount = 0;
    this._matchesAtIndex.fill(0);
    const promises = [];
    let gotReportFromEveryone = false;
    for (const findable of this._findables) {
      promises.push(new Promise<void>(resolve => {
        findable.setFind(params && {
          regex: params!.regex,
          report: matches => {
            const index = this._findables.indexOf(findable);
            this._matchesCount -= this._matchesAtIndex[index];
            this._matchesAtIndex[index] = matches;
            this._matchesCount += matches;
            if (gotReportFromEveryone)
              params?.report(this._matchesCount);
            resolve();
          }
        });
      }));
    }
    await Promise.all(promises);
    gotReportFromEveryone = true;
    params?.report(this._matchesCount);
  }
  [Symbol.iterator]() {
    return this._findables[Symbol.iterator]();
  }
  push(findable: T) {
    this._findables.push(findable);
    this._matchesAtIndex.push(0);
    findable.setFind(this._findParams);
  }
  map<U>(callbackfn: (value: T, index: number, array: T[]) => U): U[] {
    return this._findables.map(callbackfn);
  }
  removeItem(findable: T) {
    const index = this._findables.indexOf(findable);
    if (index === -1)
      return false;
    this._findables.splice(index, 1);
    this._matchesCount -= this._matchesAtIndex[index];
    this._matchesAtIndex.splice(index, 1);
    this._findParams?.report(this._matchesCount);
    return true;
  }
}