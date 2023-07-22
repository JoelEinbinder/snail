/// <reference path="../../iframe/types.d.ts" />
import type { Metadata } from '../../shell/metadata';
import './reconnect.css';

const metadatas = await d4.waitForMessage<Metadata[]>();
const now = new Date(Date.now());

const seenMetadatas: Metadata[] = [];
for (const metadata of metadatas) {
  if (metadata.connected)
    continue;
  seenMetadatas.push(metadata);
  const div = document.createElement('div');
  div.classList.add('metadata');
  const title = document.createElement('div');
  title.classList.add('title');
  title.textContent = metadata.task ? metadata.task.command : '<blank shell>';
  div.append(title);
  const time = document.createElement('div');
  time.classList.add('time');
  if (metadata.task)
    div.append(renderTime(metadata.task.started));
  if (metadata.task?.ended)
    div.classList.add('ended');
  const button = document.createElement('button');
  button.textContent = 'Reconnect';
  button.onclick = () => {
    d4.tryToRunCommand(`reconnect ${metadata.socketPath}`);
  };
  div.append(button);
  document.body.append(div);
}

window.onresize = updateSize;
function updateSize() {
  d4.setHeight(document.body.getBoundingClientRect().height);
}
d4.setToJSON(() => {
  return seenMetadatas;
});
updateSize();

if (!seenMetadatas.length)
  d4.close();

function renderTime(timestamp: number) {
  const span = document.createElement('span');
  span.classList.add('time');
  span.style.whiteSpace = 'pre';
  const date = new Date(timestamp);
  const month = date.toLocaleDateString(undefined, {
    month: 'short',
  });
  const day = date.toLocaleDateString(undefined, {
    day: 'numeric',
  });
  const year = date.toLocaleDateString(undefined, {
    year: 'numeric',
  });
  const time = date.toLocaleTimeString(undefined, {
    timeStyle: 'short',
  });
  if (now.getFullYear() === date.getFullYear()) {
    if (now.getMonth() === date.getMonth() && now.getDate() === date.getDate()) {
      span.textContent = time;
    } else {
      span.textContent = `${month} ${day.padStart(2, ' ')} ${time}`;
    }
  } else {
    span.textContent = `${month} ${day.padStart(2, ' ')} ${year}`;
  }
  return span;
}