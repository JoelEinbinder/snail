import {JoelEvent} from './JoelEvent';

let measuredFontSize: number = null;
export const font = new JoelEvent({
  size: 14,
  family: 'SFMono-Regular, ui-monospace, monospace',
});
function fontChanged() {
  document.body.style.setProperty('--current-font', fontString());
  measuredFontSize = null;
}
font.on(fontChanged);
fontChanged();

export function fontString() {
  return `${font.current.size}px ${font.current.family}`;
}
