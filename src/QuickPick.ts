import './quickPick.css'
import { diff_match_patch, DIFF_EQUAL, DIFF_INSERT, DIFF_DELETE } from './diff_match_patch';
import { availableActions, registerGlobalAction, Action } from './actions';
import { type ParsedShortcut, shortcutParser, formatShortcut } from './shortcutParser';
import { rootBlock } from './GridPane';
import { startAsyncWork } from './async';
import { setBrowserViewsHidden } from './BrowserView';
import { FilePathScoreFunction } from './FilePathScoreFunction';
import { setSelection } from './selection';
import { AntiFlicker } from './AntiFlicker';
export let activePick: QuickPick | undefined;
interface QuickPickItem {
  title: string;
  shortcut?: string;
  callback: () => void;
}
export interface QuickPickProvider {
  // Title for this provider in the quick pick help
  title: string;
  prefix: string;
  items: (abortSignal: AbortSignal, callback: (item: QuickPickItem) => void, warn: (message: string) => void) => QuickPickItem[]|Promise<void>;
  renderItem?(item: QuickPickItem, query: string): HTMLElement;
}
class QuickPick {
  private _element = document.createElement('dialog');
  private _input = document.createElement('input');
  private _optionsTray = document.createElement('div');
  private _warningContainer = document.createElement('div');
  private _selected?: HTMLElement;
  private _doFocus = () => this._input.focus();
  private _abortController: AbortController|undefined;
  private _didDraw: () => void;
  constructor(initialText: string, private _providers: QuickPickProvider[]) {
    this._element.classList.add('quick-pick');
    this._optionsTray.classList.add('quick-pick-options');
    this._warningContainer.classList.add('quick-pick-warning');
    this._element.append(this._input, this._warningContainer, this._optionsTray);
    const antiFlicker = new AntiFlicker(
      () => this._element.style.opacity = '0',
      () => this._element.style.opacity = '1');
    this._didDraw = antiFlicker.expectToDraw(1000);
    document.body.append(this._element);
    activePick = this;
    setBrowserViewsHidden(true);

    this._input.value = initialText;
    this._input.spellcheck = false;
    this._render();
    this._element.showModal();
    this._element.addEventListener('close', event => {
      this.dispose();
    });
    // dismiss on backdrop click
    this._element.addEventListener('mousedown', event => {
      const rect = this._element.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
        this.dispose();
    });
    this._element.addEventListener('mouseup', event => {
      this._input.focus();
    });
    this._input.addEventListener('input', () => {
      this._render();
    });
    this._input.addEventListener('focus', () => {
      setSelection(() => window.getSelection().toString());
    });
    window.addEventListener('focus', this._doFocus);
    this._input.focus();
    setSelection(() => window.getSelection().toString());
    this._input.addEventListener('keydown', event => {
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)
        return;
      if (event.code === 'ArrowDown') {
        const next = this._selected?.nextElementSibling || this._optionsTray.firstElementChild;
        this._selectElement(next as HTMLElement);
      } else if (event.code === 'ArrowUp') {
        const prev = this._selected?.previousElementSibling || this._optionsTray.lastElementChild;
        this._selectElement(prev as HTMLElement);
      } else if (event.code === 'Enter') {
        this._selected?.click();
      } else if (event.code === 'Escape') {
        this.dispose();
      } else {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    });
  }

  dispose() {
    if (!this._element.isConnected)
      return;
    window.removeEventListener('focus', this._doFocus);
    if (this._element.open)
      this._element.close();
    this._element.remove();
    activePick = undefined;
    setBrowserViewsHidden(false);
    if (document.activeElement === document.body) {
      rootBlock.block?.focus();
    } else {
      // dialog does some crazy async stuff if we don't refocus
      const before = document.activeElement;
      if (before instanceof HTMLElement || before instanceof SVGElement) {
        before.blur();
        before.focus();
      }
    }
  }

  async _render() {

    this._abortController?.abort();
    const {signal} = this._abortController = new AbortController();

    this._optionsTray.textContent = '';
    this._warningContainer.textContent = '';
    this._selectElement(undefined);
    const provider = this._providers.filter(x => this._input.value.startsWith(x.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
    if (!provider) {
      this._selectElement(undefined);
      return;
    }
    const query = this._input.value.substring(provider.prefix.length);
    const doUpdate = () => {
      this._optionsTray.textContent = '';
      this._selectElement(undefined);
      const scorer = new FilePathScoreFunction(query);
      const sortedItems = items.map((item) => {
        const score = scorer.calculateScore(item.title, null);
        if (score <= 0 && query)
          return null;
        return {item, score};
      }).filter(x => x).sort((a, b) => b.score - a.score).slice(0, 100).map(({item}) => {
        let element = provider.renderItem?.(item, query);
        if (!element) {
          const { title, shortcut } = item;
          element = document.createElement('div');
          const diff = new diff_match_patch().diff_main(query.toLowerCase(), title.toLowerCase());

          let index = 0;
          const titleElement = document.createElement('span');
          titleElement.classList.add('title');
          element.append(titleElement);
          for (const {0: type, 1: text} of diff) {
            if (type === DIFF_EQUAL) {
              const span = document.createElement('span');
              const sliced = title.slice(index, index + text.length);
              span.textContent = sliced;
              span.classList.add('match');
              titleElement.append(span);
            } else if (type === DIFF_INSERT) {
              const sliced = title.slice(index, index + text.length);
              titleElement.append(sliced);
            }
            index += text.length;
          }

          element.classList.add('quick-pick-option');
          if (shortcut) {
            const shortcutElement = document.createElement('span');
            shortcutElement.classList.add('shortcut');
            shortcutElement.textContent = formatShortcut(shortcutParser(shortcut));
            element.append(shortcutElement);
          }
        }
        element.addEventListener('click', () => {
          this.dispose();
          item.callback();
        });
        return element;
      });
      for (const element of sortedItems) {
        this._optionsTray.append(element);
        if (!this._selected)
          this._selectElement(element);
      }
      this._didDraw();
    }
    const items: QuickPickItem[] = [];
    let lastUpdate = Date.now();
    const retVal = provider.items(signal, item => {
      if (signal.aborted)
        return;
      items.push(item);
      if (Date.now() - lastUpdate > 100 && items.length > 100) {
        doUpdate();
        lastUpdate = Date.now();
      }
    }, warningMessage => {
      this._warningContainer.textContent = warningMessage;
    });
    if (Array.isArray(retVal))
      items.push(...retVal);
    else
      await retVal;
    if (signal.aborted)
      return;
    doUpdate();
  }

  _selectElement(element?: HTMLElement) {
    this._selected?.classList.remove('selected');
    this._selected = element;
    this._selected?.classList.add('selected');
    this._selected?.scrollIntoView({
      block: 'nearest'
    });
  }

  serializeForTest() {
    return {
      type: 'quick-pick',
      value: this._input.value,
    }
  }
}

let lastQuickPick: QuickPick | undefined;
export async function showQuickPick(prefix: string) {
  const done = startAsyncWork('loading quickpick');
  const actions = [...availableActions(), ...await rootBlock.asyncActions()];
  const providers: QuickPickProvider[] = [
    ...await rootBlock.quickPicks(), {
    prefix: '?',
    title: 'Help',
    items: () => {
      return providers.map(provider => ({
        callback: () => {
          showQuickPick(provider.prefix);
        },
        title: provider.title,
      }))
    }
  }, {
    prefix: '>',
    title: 'Actions',
    items: () => {
      return actions.map(({title, callback, shortcut}) => {
        return {title, callback, shortcut}
      });
    }
  }];
  if (lastQuickPick)
    lastQuickPick.dispose();
  lastQuickPick = new QuickPick(prefix, providers);
  done();
}

registerGlobalAction({
  callback: async () => {
    await showQuickPick('>');
  },
  title: 'Show all actions',
  id: 'quick.action',
  shortcut: 'Shift+CmdOrCtrl+P',
});

// declare var module: any;
// if (module.hot) {
//   if (module.hot.data?.activePick && !activePick)
//     new QuickPick();
//   module.hot.dispose(data => {
//     data.activePick = activePick;
//     activePick?.dispose();
//   });
//   module.hot.accept();
// }
