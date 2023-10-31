/// <reference path="../slug/iframe/types.d.ts" />
import './reset-iframe.css';
const {bytes} = await snail.waitForMessage<{bytes: number}>();
document.body.append('You have ' + bytes + ' bytes.');
const abilities = [
  { name: 'heal_after_battle', cost: 10, description: 'Heal a small amount after each battle' },
  { name: 'starting_item', cost: 10, description: 'Start with an item' },
  { name: 'increased_level', cost: 300, description: 'Increase your starting level' },
];
let bytesAvailable = bytes;
const listeners = [];
const enabled = new Set();
const inputs = [];
for (const power of abilities) {
  const input = document.createElement('input');
  inputs.push(input);
  input.type = 'checkbox';
  const label = document.createElement('label');
  if (power.cost > bytesAvailable)
    power.description = '???';
  label.append(input, `${power.cost} bytes, ${power.description}`);
  document.body.append(label);
  listeners.push(() => {
    input.disabled = !input.checked && bytesAvailable < power.cost;
  });
  input.addEventListener('change', () => {
    if (input.checked) {
      bytesAvailable -= power.cost;
      enabled.add(power.name);
    } else {
      bytesAvailable += power.cost;
      enabled.delete(power.name);
    }
    for (const listener of listeners)
      listener();
  });
  if (power.cost > bytesAvailable)
    break;
}
for (const listener of listeners)
  listener();
const doneButton = document.createElement('button');
doneButton.textContent = 'Done';
document.body.append(doneButton);
const done = () => {
  snail.sendInput(JSON.stringify([...enabled]));
};
doneButton.addEventListener('click', done);
document.addEventListener('keydown', event => {
  if (event.key === 'Enter')
    done();
  else if (event.key === 'Escape')
    snail.sendInput('[]');
  else if (event.key === 'ArrowUp')
    inputs[inputs.indexOf(document.activeElement) - 1]?.focus();
  else if (event.key === 'ArrowDown')
    inputs[inputs.indexOf(document.activeElement) + 1]?.focus();
  else
    return;
  event.preventDefault();
  event.stopPropagation();
});
inputs[0].focus();
snail.setHeight(document.body.offsetHeight);
