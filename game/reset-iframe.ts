/// <reference path="../slug/iframe/types.d.ts" />
import './reset-iframe.css';
const {bytes} = await d4.waitForMessage<{bytes: number}>();
document.body.append('You have ' + bytes + ' bytes.');
const abilities = [
  { name: 'heal_after_battle', cost: 10, description: 'Heal a small amount after each battle' },
  { name: 'starting_element', cost: 15, description: 'Start your adventure wtih a random elemental type'},
  { name: 'increased_attack', cost: 300, description: 'Increase your attack by 3' },
];
let bytesAvailable = bytes;
const listeners = [];
const enabled = new Set();
for (const power of abilities) {
  const input = document.createElement('input');
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
doneButton.addEventListener('click', () => {
  d4.sendInput(JSON.stringify([...enabled]));
});
d4.setHeight(document.body.offsetHeight);
