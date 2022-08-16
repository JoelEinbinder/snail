/// <reference path="../../iframe/types.d.ts" />
import './index.css';
import {iconPathForPath} from './material-icons';
import {DataGrid} from '../../datagrid/datagrid';
type Entry = {
  dir: string,
  nlink: number,
  uid: number,
  gid: number,
  username: string;
  groupname: string;
  time: string,
  link?: string,
  mode: number,
  size: number,
  isSymbolicLink: boolean,
  isDirectory: boolean,
};
const {dirs, cwd, showHidden, platform, args} = await d4.waitForMessage<{
  dirs: Entry[];
  cwd: string;
  showHidden: boolean;
  platform: string;
  args: string[];
}>();

const useTable = args.some(a => a.startsWith('-') && a.includes('l'));

function renderTable() {
  const dataGrid = new DataGrid<Entry>([{
    title: 'Permissions',
    render(item) {
      const mode = document.createElement('span');
      const full = 'rwxrwxrwx';
      let str = item.isDirectory ? 'd' : '-';
      for (let i = 0; i < full.length; i++) {
        str += item.mode & (1 << (full.length - i - 1)) ? full[i] : '-';
      }
      mode.textContent = str;
      return mode;
    }
  }, {
    title: 'Hard Links',
    render(item) {
      const span = document.createElement('span');
      span.textContent = String(item.nlink);
      return span;
    }
  }, {
    title: 'User',
    render(item) {
      const span = document.createElement('span');
      span.textContent = String(item.username);
      return span;
    }
  }, {
    title: 'Group',
    render(item) {
      const span = document.createElement('span');
      span.textContent = String(item.groupname);
      return span;
    }
  }, {
    title: 'Size',
    render(item) {
      const span = document.createElement('span');
      span.textContent = String(item.size);
      return span;
    }
  }, {
    title: 'Date Modified',
    render(item) {
      const span = document.createElement('span');
      span.textContent = new Date(item.time).toLocaleString(undefined, {
        dateStyle: 'long',
        timeStyle: 'short'
      });
      return span;
    }
  }, {
    title: 'Name',
    render(item) {
      const div = document.createElement('div');
      div.textContent = item.dir;
      return div;
    }
  }]);
  dataGrid.setItems(dirs.filter(x => !showHidden || !x.dir.startsWith('.')));
  document.body.append(dataGrid.element);
  console.log((document.head.children[3] as HTMLLinkElement).sheet);
  d4.setHeight(document.body.offsetHeight);
}
if (useTable)
  renderTable();
else
  inlineMode();
function inlineMode() {
  document.body.style.visibility = 'hidden';
  const imageLoadPromises: Promise<any>[] = [];
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
        title: 'Copy absolute path',
        callback: () => {
          navigator.clipboard.writeText(fullPath);
        }
      }, {
        title: 'Copy path item',
        callback: () => {
          navigator.clipboard.writeText(dir);
        }
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
    document.body.style.setProperty('--rows', String(rows));
    document.body.style.setProperty('--cols', String(cols));
    d4.setHeight(document.body.offsetHeight);
  }
}
