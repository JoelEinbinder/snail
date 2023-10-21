import './tooltip.css';
let toolbarId = 0;
const tooltip = document.createElement('div');
tooltip.classList.add('tooltip');

export function showTooltip({x, y}, content: Node) {
  const id = ++toolbarId;
  document.body.appendChild(tooltip);
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  tooltip.textContent = '';
  tooltip.appendChild(content);
  return () => {
    if (id !== toolbarId)
      return;
    tooltip.remove();
  }
}
