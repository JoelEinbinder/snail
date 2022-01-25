let selection: string | (() => string) = '';
document.addEventListener('copy', event => {
  const str = typeof selection === 'string' ? selection : selection();
  event.preventDefault();
  event.clipboardData.setData('text/plain', str);
  console.log('copied', str);
  event.stopImmediatePropagation();
}, true);

export function setSelection(sel: string | (() => string)) {
  selection = sel;
}
