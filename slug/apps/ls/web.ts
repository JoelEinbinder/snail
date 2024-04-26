import * as snail from '../../sdk/web';
import './web.css';
import {iconPathForPath, looksLikeImageOrVideo} from '../../icon_service/iconService';
import {DataGrid} from '../../datagrid/datagrid';
type Entry = {
  dir: string,
  nlink: number,
  uid: number,
  gid: number,
  username: string;
  groupname: string;
  mtime: string,
  ctime: string;
  atime: string;
  birthtime: string;
  link?: string,
  mode: number,
  size: number,
  isSymbolicLink: boolean,
  isDirectory: boolean,
  isFIFO: boolean,
  isSocket: boolean,
  isBlockDevice: boolean,
  isCharacterDevice: boolean,
  isFile: boolean,
  mimeType: string,
  fullPath: string,
  children?: Entry[],
};
const {dirs, cwd, showHidden, platform, args} = await snail.waitForMessage<{
  dirs: Entry[];
  cwd: string;
  showHidden: boolean;
  platform: string;
  args: string[];
}>();
const initialDpr = await snail.getDevicePixelRatio();
const useTable = args.some(a => a.startsWith('-') && a.includes('l'));
const now = new Date(Date.now());

function shortType(item: Entry) {
  if (item.isDirectory)
    return 'd';
  if (item.isSymbolicLink)
    return 'l';
  if (item.isFile)
    return '-';
  if (item.isBlockDevice)
    return 'b';
  if (item.isCharacterDevice)
    return 'c';
  if (item.isFIFO)
    return 'p';
  if (item.isSocket)
    return 's';
  return '?';
}
function longType(item: Entry) {
  if (item.isDirectory)
    return 'Directory';
  if (item.isSymbolicLink)
    return 'Link';
  if (item.isFile)
    return 'File';
  if (item.isBlockDevice)
    return 'Block Device';
  if (item.isCharacterDevice)
    return 'Character Device';
  if (item.isFIFO)
    return 'Fifo Pipe';
  if (item.isSocket)
    return 'Socket';
  return '???';
}

async function renderTable() {
  const dataGrid = new DataGrid<Entry>([{
    title: 'Permissions',
    render(item) {
      const mode = document.createElement('span');
      const full = 'rwxrwxrwx';
      let str = shortType(item);
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
    title: 'Type',
    render(item) {
      const span = document.createElement('span');
      span.textContent = longType(item);
      return span;
    },
    compare(a, b) {
      return longType(b).localeCompare(longType(a));
    },
    defaultHidden: true,
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
        style: 'unit',
        unitDisplay: 'narrow',
      });
      span.title = item.size.toString();
      return span;
    },
    compare(a, b) {
      return a.size - b.size;
    }
  }, {
    title: 'Bytes',
    render(item) {
      const span = document.createElement('span');
      span.textContent = item.size.toString();
      return span;
    },
    compare(a, b) {
      return a.size - b.size;
    },
    defaultHidden: true,
  }, {
    title: 'Date Modified',
    render(item) {
      const span = document.createElement('span');
      span.style.whiteSpace = 'pre';
      const date = new Date(item.mtime);
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
      return new Date(a.mtime).valueOf() - new Date(b.mtime).valueOf();
    },
  }, {
    title: 'Date Created',
    render(item) {
      const span = document.createElement('span');
      span.style.whiteSpace = 'pre';
      const date = new Date(item.birthtime);
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
      return new Date(a.birthtime).valueOf() - new Date(b.birthtime).valueOf();
    },
    defaultHidden: true,
  }, {
    title: 'Date Last Opened',
    render(item) {
      const span = document.createElement('span');
      span.style.whiteSpace = 'pre';
      const date = new Date(item.atime);
      if (new Date(item.atime).valueOf() - new Date(item.mtime).valueOf() < 60_000) {
        span.textContent = '--';
        return span;
      }
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
      return new Date(a.atime).valueOf() - new Date(b.atime).valueOf();
    },
    defaultHidden: true,
  }, {
    title: 'MIME Type',
    render(item) {
      const span = document.createElement('span');
      span.textContent = item.mimeType;
      return span;
    },
    compare(a, b) {
      return b.mimeType.localeCompare(a.mimeType);
    },
    defaultSortDirection: -1,
    defaultHidden: true,
  }, {
    title: 'Name',
    render(item) {
      const {element, readyPromise} = makeImageForPath(item.fullPath, item);
      const div = document.createElement('div');
      div.append(element, item.dir);
      return div;
    },
    compare(a, b) {
      return b.dir.localeCompare(a.dir);
    },
    defaultSortDirection: -1,
    alwaysVisible: true,
  }], {
    async loadItem(item) {
      return snail.loadItem(`ls.${item}`);
    },
    async saveItem(item, value) {
      return snail.saveItem(`ls.${item}`, value);
    }
  });
  await dataGrid.loadAllData();
  const dirsToShow = (dirs.length === 1 && dirs[0].children) ? dirs[0].children : dirs;
  dataGrid.setItems(dirsToShow.filter(x => showHidden || !x.dir.startsWith('.')));
  document.body.append(dataGrid.element);
  snail.setHeight(document.body.getBoundingClientRect().height);
}
if (useTable)
  renderTable();
else
  inlineMode();

function inlineMode() {
  class GridContainer {
    element = document.createElement('div');
    count = 0;
    constructor() {
      this.element.classList.add('grid-container');
      document.body.append(this.element);
      gridContainers.push(this);
    }
  }
  document.body.style.visibility = 'hidden';
  const gridContainers: GridContainer[] = [];
  const imageLoadPromises: Promise<any>[] = [];
  let activeGridContainer = new GridContainer();
  if (dirs.length === 1 && dirs[0].children) {
    for (const info of dirs[0].children)
      processDir(info, false);
  } else for (const info of dirs) {
    processDir(info, true);
  }
  function processDir(info: Entry, topLevel: boolean) {
    const {dir, fullPath} = info;
    if (!topLevel && !showHidden && dir.startsWith('.'))
      return;
    const div = document.createElement('div');
    const {element, readyPromise} = makeImageForPath(info.fullPath, info);
    element.style.cursor = 'pointer';
    element.onclick = () => {
      snail.tryToRunCommand(`ls ${JSON.stringify(fullPath)}`);
    };
  
    imageLoadPromises.push(readyPromise);
    div.append(element, dir);
    div.title = fullPath;
    if (info.link)
      div.title += ' -> ' + info.link;
    if (info.mode & 0o111 && !info.isDirectory)
      div.classList.add('executable');
    div.addEventListener('contextmenu', event => {
      snail.createContextMenu([{
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
    if (info.children) {
      div.classList.add('has-children');
      document.body.append(div);
      activeGridContainer = new GridContainer();
      for (const child of info.children)
        processDir(child, false);
      activeGridContainer = new GridContainer();
    } else {
      activeGridContainer.element.append(div);
      activeGridContainer.count++; 
    }
  }
  for (const container of gridContainers) {
    if (container.count === 0)
      container.element.remove();
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
    for (const container of gridContainers) {
      const cols = Math.floor(window.innerWidth / 200) || 1;
      const rows = Math.ceil(container.count / cols);
      container.element.style.setProperty('--rows', String(rows));
      container.element.style.setProperty('--cols', String(cols));
    }
    snail.setHeight(document.body.getBoundingClientRect().height);
  }
  snail.setToJSON(() => {
    return gridContainers.map(x => {
      return x.element.textContent;
    });
  });
}
let undoFind: (() => void) | null = null;
snail.setFindHandler(params => {
  undoFind?.();
  if (!params)
    return;
  const { regex, report } = params;
  let count = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let currentNode: Node | null = null;
  const undos: (() => void)[] = [];
  const applies: (() => void)[] = [];
  while (currentNode = walker.nextNode()) {
    const text = currentNode.textContent!;
    const matches = [...text.matchAll(regex)];
    if (!matches.length)
      continue;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    const parent = currentNode.parentNode!;
    const current = currentNode;
    for (const match of matches) {
      fragment.append(text.slice(cursor, match.index));
      const span = document.createElement('span');
      span.classList.add('find-match');
      span.textContent = match[0];
      fragment.append(span);
      undos.push(() => {
        parent.replaceChild(document.createTextNode(match[0]), span);
        parent.normalize();
      });
      cursor = match.index! + match[0].length;
      count++;
    }
    fragment.append(text.slice(cursor));
    applies.push(() => parent.replaceChild(fragment, current));
  }
  for (const apply of applies)
    apply();
  report(count);
  undoFind = () => {
    for (const undo of undos)
      undo();
    undoFind = null;
  };
});

function makeImageForPath(fullPath: string, info: Entry) {
  if (!looksLikeImageOrVideo(info) || platform !== 'darwin')
    return iconPathForPath(fullPath, info);
  const image = document.createElement('img');
  image.src = `${fullPath}?thumbnail&size=${initialDpr * 16}`;
  image.width = image.height = 16;
  return {
    element: image,
    readyPromise: new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    })
  };
}
