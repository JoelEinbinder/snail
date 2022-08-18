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
const now = new Date(Date.now());
async function renderTable() {
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
    },
    compare(a, b) {
      return a.mode - b.mode;
    }
  }, {
    title: 'Links',
    render(item) {
      const span = document.createElement('span');
      span.textContent = String(item.nlink);
      return span;
    },
    compare(a, b) {
      return a.nlink - b.nlink;
    }
  }, {
    title: 'User',
    render(item) {
      const span = document.createElement('span');
      span.textContent = item.username;
      return span;
    },
    compare(a, b) {
      return a.username.localeCompare(b.username);
    }
  }, {
    title: 'Group',
    render(item) {
      const span = document.createElement('span');
      span.textContent = item.groupname;
      return span;
    },
    compare(a, b) {
      return a.groupname.localeCompare(b.groupname);
    }
  }, {
    title: 'Size',
    render(item) {
      const span = document.createElement('span');
      span.textContent = item.size.toLocaleString(undefined, {
        unit: 'byte',
        notation: 'compact',
      })
      return span;
    },
    compare(a, b) {
      return a.size - b.size;
    }
  }, {
    title: 'Date Modified',
    render(item) {
      const span = document.createElement('span');
      span.style.whiteSpace = 'pre';
      const date = new Date(item.time);
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
      const isSameYear = now.getFullYear() === date.getFullYear();
      span.textContent = `${month} ${day.padStart(2, ' ')} ${isSameYear ? time : year}`;
      return span;
    },
    compare(a, b) {
      return new Date(a.time).valueOf() - new Date(b.time).valueOf();
    }
  }, {
    title: 'Name',
    render(item) {
      const fullPath = `${cwd === '/' ? '' : cwd}/${item.dir}`;
      const image = makeImageForPath(fullPath, item);
      const div = document.createElement('div');
      div.append(image, item.dir);
      return div;
    },
    compare(a, b) {
      return a.dir.localeCompare(b.dir);
    },
    alwaysVisible: true,
  }], {
    async loadItem(item) {
      return d4.loadItem(`ls.${item}`);
    },
    async saveItem(item, value) {
      return d4.saveItem(`ls.${item}`, value);
    }
  });
  await dataGrid.loadAllData();
  dataGrid.setItems(dirs.filter(x => showHidden || !x.dir.startsWith('.')));
  document.body.append(dataGrid.element);
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
    const fullPath = `${cwd === '/' ? '' : cwd}/${dir}`;
    const image = makeImageForPath(fullPath, info);
    imageLoadPromises.push(new Promise(x => {
      image.onload = x;
      image.onerror = x;
    }));
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
  Promise.race([
    new Promise(x => setTimeout(x, 250)),
    Promise.all(imageLoadPromises),
  ]).then(() => {
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

function makeImageForPath(fullPath: string, info: Entry) {
  const image = document.createElement('img');
  if (platform === 'darwin') {
    image.src = `${fullPath}?thumbnail`;
  } else {
    image.src = iconPathForPath(fullPath, info);
  }
  image.width = image.height = 16;
  return image;
}