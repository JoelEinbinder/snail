import './index.css';

const {dirs, cwd, showHidden} = await d4.waitForMessage();
document.body.style.visibility = 'hidden';
const imageLoadPromises = [];
let count = 0;
for (const dir of dirs) {
  if (!showHidden && dir.startsWith('.'))
    continue;
  const div = document.createElement('div');
  const image = document.createElement('img');
  const fullPath = `${cwd === '/' ? '' : cwd}/${dir}`;
  imageLoadPromises.push(new Promise(x => {
    image.onload = x;
    image.onerror = x;
  }));
  image.src = `${fullPath}?thumbnail`;
  image.width = image.height = 16;
  div.append(image, dir);
  div.title = fullPath;
  document.body.append(div);
  count++;
}
Promise.all(imageLoadPromises).then(() => {
  document.body.style.visibility = 'visible';
  updateSize();
})
window.onresize = updateSize;
function updateSize() {
  const cols = Math.floor(window.innerWidth / 200) || 1;
  const rows = Math.ceil(count / cols);
  document.body.style.setProperty('--rows', rows);
  document.body.style.setProperty('--cols', cols);
  d4.setHeight(document.body.offsetHeight);
}
