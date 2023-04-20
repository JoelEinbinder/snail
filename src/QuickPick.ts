import './quickPick.css'
import { diff_match_patch, DIFF_EQUAL, DIFF_INSERT, DIFF_DELETE } from './diff_match_patch';
import { availableActions, registerGlobalAction, Action } from './actions';
import { type ParsedShortcut, shortcutParser } from './shortcutParser';
import { rootBlock } from './GridPane';
import { startAyncWork } from './async';
import { setBrowserViewsHidden } from './BrowserView';
export let activePick: QuickPick | undefined;
const isMac = navigator['userAgentData']?.platform === 'macOS';
class QuickPick {
  private _element = document.createElement('dialog');
  private _input = document.createElement('input');
  private _optionsTray = document.createElement('div');
  private _selected?: HTMLElement;
  private _doFocus = () => this._input.focus();
  constructor(private _actions: Action[]) {
    this._element.classList.add('quick-pick');
    this._optionsTray.classList.add('quick-pick-options');
    this._element.append(this._input, this._optionsTray);
    document.body.append(this._element);
    activePick = this;
    setBrowserViewsHidden(true);

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
    window.addEventListener('focus', this._doFocus);
    this._input.focus();
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
    if (this._element.open)
      this._element.close();
    this._element.remove();
    activePick = undefined;
    window.removeEventListener('focus', this._doFocus);
    setBrowserViewsHidden(false);
    if (document.activeElement === document.body)
      rootBlock.block?.focus();
  }

  _render() {
    this._optionsTray.textContent = '';
    this._selectElement(undefined);
    const query = this._input.value;
    const sortedItems = this._actions.map(({title, callback, shortcut}) => {
      const diff = new diff_match_patch().diff_main(query.toLowerCase(), title.toLowerCase());
      const element = document.createElement('div');
      let total = 0;
      for (const {0: type, 1: text} of diff) {
        if (type === DIFF_EQUAL)
          total += text.length;
      }
      if (total < query.length)
        return null;
      let score = 0;
      let index = 0;
      for (const {0: type, 1: text} of diff) {
        if (type === DIFF_EQUAL) {
          score += text.length ** 2;
          const span = document.createElement('span');
          const sliced = title.slice(index, index + text.length);
          span.textContent = sliced;
          span.classList.add('match');
          element.append(span);
        } else if (type === DIFF_INSERT) {
          const sliced = title.slice(index, index + text.length);
          element.append(sliced);
        }
        index += text.length;
      }

      if (shortcut) {
        const shortcutElement = document.createElement('span');
        shortcutElement.classList.add('shortcut');
        shortcutElement.textContent = formatShortcut(shortcutParser(shortcut, isMac));
        element.append(shortcutElement);
      }

      element.classList.add('quick-pick-option');
      element.addEventListener('click', () => {
        this.dispose();
        callback();
      });
      return {element, score};
    }).filter(x => x).sort((a, b) => b.score - a.score);
    for (const item of sortedItems) {
      this._optionsTray.append(item.element);
      if (!this._selected)
        this._selectElement(item.element);
    }
  }

  _selectElement(element?: HTMLElement) {
    this._selected?.classList.remove('selected');
    this._selected = element;
    this._selected?.classList.add('selected');
    this._selected?.scrollIntoView();
  }

  serializeForTest() {
    return {
      type: 'quick-pick',
      value: this._input.value,
    }
  }
}

registerGlobalAction({
  callback: async () => {
    const done = startAyncWork('loading quickpick');
    const actions = [...availableActions(), ...await rootBlock.asyncActions()];
    new QuickPick(actions);
    done();
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
function formatShortcut(shortcut: ParsedShortcut) {
  const parts = [];
  if (isMac) {
    if (shortcut.metaKey)
      parts.push('⌘');
    if (shortcut.ctrlKey)
      parts.push('⌃');
    if (shortcut.altKey)
      parts.push('⌥');
    if (shortcut.shiftKey)
      parts.push('⇧');
  } else {
    if (shortcut.metaKey)
      parts.push('Win');
    if (shortcut.ctrlKey)
      parts.push('Ctrl');
    if (shortcut.altKey)
      parts.push('Alt');
    if (shortcut.shiftKey)
      parts.push('Shift');
  }
  if (isMac && shortcut.key === 'Tab')
    parts.push('⇥');
  else
    parts.push(shortcut.key);
  const joined = parts.join(' ');
  if (!shortcut.continuation)
    return joined;
  return joined + ' ' + formatShortcut(shortcut.continuation);
}