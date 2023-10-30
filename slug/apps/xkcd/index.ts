///<reference path="../../iframe/types.d.ts" />
import './index.css';
window.onresize = updateSize;
function updateSize() {
  snail.setHeight(document.body.offsetHeight);
}
const message = await snail.waitForMessage<string>();
const parser = new DOMParser()
const parsed = parser.parseFromString(message, 'application/xml');

const entry = parsed.querySelector('feed > entry');
const title = entry?.querySelector('title')?.textContent;
const summary = entry?.querySelector('summary')?.textContent;
const h1 = document.createElement('h1');
h1.textContent = title || '';
document.body.append(h1);
updateSize();

const newParser = new DOMParser();
const html = newParser.parseFromString(summary || '', 'text/html');
const img = html.querySelector('img')!;
const titleText = img.title;
const href = img.src;
const highRes = new Image();
highRes.src = href.replace(/.png$/, '_2x.png');
highRes.onload = () => {
  const canvas = document.createElement('canvas');
  canvas.width = highRes.width;
  canvas.height = highRes.height;
  canvas.style.width = `${highRes.width / 2}px`;
  canvas.style.height = `${highRes.height / 2}px`;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'difference'
  ctx.drawImage(highRes, 0, 0, highRes.width, highRes.height, 0, 0, canvas.width, canvas.height);
  const altText = document.createElement('div');
  altText.textContent = titleText;
  document.body.append(altText);
  updateSize();
}


export {}