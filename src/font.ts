import {JoelEvent} from './JoelEvent';

let measuredFontSize: number = null;
export const font = new JoelEvent({
  size: 10,
  family: 'Monaco',
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
