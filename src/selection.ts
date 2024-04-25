import { host } from "./host";

let selection: string | (() => string) = '';
document.addEventListener('copy', event => {
  const str = typeof selection === 'string' ? selection : selection();
  event.preventDefault();
  event.clipboardData.setData('text/plain', str);
  event.stopImmediatePropagation();
}, true);
document.addEventListener('selectionchange', event => {
  if (document.activeElement !== document.body)
    return;
  setSelection(() => window.getSelection().toString());
}, true);

export function setSelection(sel: string | (() => string)) {
  selection = sel;
}

export function somethingSelected() {
  const str = typeof selection === 'string' ? selection : selection();
  return !!str;
}