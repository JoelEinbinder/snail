import './iconCheckbox.css'

export function makeIconCheckbox(icon: 'overscan'|'xLog'|'yLog'|'selection-drag'): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.classList.add('icon');
  input.classList.add(icon);
  return input;
}