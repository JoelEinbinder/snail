let selection: string | (() => string) = '';
document.addEventListener('copy', event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  const text = getSelection();
  if (!text)
    return;
  event.clipboardData.setData('text/plain', text);
}, true);
document.addEventListener('selectionchange', event => {
  if (document.activeElement !== document.body)
    return;
  setSelection(() => window.getSelection().toString());
}, true);

export function setSelection(sel: string | (() => string)) {
  selection = sel;
}

function getSelection() {
  return typeof selection === 'string' ? selection : selection();
}

export function somethingSelected() {
  return !!getSelection();
}
document.addEventListener('keydown', event => {
  if (event.code !== 'KeyC' || !event.shiftKey)
    return;
  const isMac = navigator['userAgentData']?.platform === 'macOS' || navigator.platform === 'MacIntel';
  if (isMac)
    return;
  if (event.defaultPrevented)
    return;
  const text = getSelection();
  if (!text)
    return;
  navigator.clipboard.writeText(text);
});
