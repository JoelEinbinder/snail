import './index.css';
import {iconPathForPath} from './material-icons';
const {dirs, cwd, showHidden, platform} = await d4.waitForMessage();
document.body.style.visibility = 'hidden';
const imageLoadPromises = [];
let count = 0;
for (const info of dirs) {
  const {dir} = info;
  if (!showHidden && dir.startsWith('.'))
    continue;
  const div = document.createElement('div');
  const image = document.createElement('img');
  const fullPath = `${cwd === '/' ? '' : cwd}/${dir}`;
  imageLoadPromises.push(new Promise(x => {
    image.onload = x;
    image.onerror = x;
  }));
  if (platform === 'darwin') {
    image.src = `${fullPath}?thumbnail`;
  } else {
    image.src = iconPathForPath(fullPath, info);
  }
  image.width = image.height = 16;
  div.append(image, dir);
  div.title = fullPath;
  if (info.link)
    div.title += ' -> ' + info.link;
  if (info.mode & 0o111 && !info.isDirectory)
    div.classList.add('executable');
  div.addEventListener('contextmenu', event => {
    d4.createContextMenu([{
      title: 'Copy',
      submenu: [{
        title: 'Copy absolute path',
        callback: () => {
          navigator.clipboard.writeText(fullPath);
        }
      }, {
        title: 'Copy path item',
        callback: () => {
          navigator.clipboard.writeText(dir);
        }
      }]
    }])
    event.preventDefault();
  });
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
