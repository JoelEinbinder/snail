process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
const { app, BrowserWindow, ipcMain, Menu, MenuItem } = require('electron');
const { handler } = require('../host');
let windowNumber = 0;
app.setName('Terminal');
/** @type {Set<BrowserWindow>} */
const windows = new Set();
const menu = new Menu();
menu.append(new MenuItem({
  label: 'Electron',
  submenu: [{
    role: 'quit'
  }]
}));
menu.append(new MenuItem({
  label: 'Shell',
  submenu: [{
    label: 'New Tab',
    accelerator: 'CommandOrControl+T',
    click: () => makeWindow()
  }, {
    role: 'close',
  }, {
    label: 'New LogBook Window',
    click: () => {
      const win = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'LogBook',
        tabbingIdentifier: (++windowNumber).toString(),
        webPreferences: {
          preload: __dirname + '/preload.js',
        },
        backgroundColor: '#000',
      });
      win.loadURL('http://localhost/gap-year/?logbook');
    }
  }]
}))

menu.append(new MenuItem({
  label: 'Edit',
  role: 'editMenu',
  submenu: [{
    role: 'cut'
  }, {
    role: 'copy'
  }, {
    role: 'paste'
  }, {
    role: 'selectAll'
  }]
}));
menu.append(new MenuItem({
  label: 'View',
  role: 'viewMenu',
  submenu: [{
    role: 'toggleTabBar'
  }, {
    role: 'zoomIn'
  }, {
    role: 'zoomOut'
  }, {
    role: 'resetZoom'
  }]
}));

menu.append(new MenuItem({
  label: 'Develop',
  submenu: [{
    role: 'reload',
  }, {
    role: 'toggleDevTools'
  }, {
    role: 'forceReload'
  }]
}))

menu.append(new MenuItem({
  label: 'Window',
  role: 'window',
  submenu: [{
    role: 'minimize'
  }, {
    role: 'zoom'
  }]
}))

Menu.setApplicationMenu(menu)
app.whenReady().then(() => {
  makeWindow();

});
/** @type {Set<BrowserWindow>} */
const popups = new Set();
function makeWindow() {
  const focusedWindow = [...windows].find(x => x.isFocused());
  const win = new BrowserWindow({
    width: 490,
    height: 371,
    title: 'Terminal',
    tabbingIdentifier: (++windowNumber).toString(),
    webPreferences: {
      preload: __dirname + '/preload.js',
    },
    backgroundColor: '#000',
  });
  win.webContents.setWindowOpenHandler((details) => {
    return {
      action: 'allow', 
      overrideBrowserWindowOptions: {
        transparent: true,
        roundedCorners: false,
        frame: false,
        focusable: false,
        alwaysOnTop: true,
        hasShadow: false,
        resizable: false,
        height: 200,
        width: 150,
      }
    };
  });
  let lastBounds = win.getBounds();
  win.on('move', () => {
    const newBounds = win.getBounds();
    for (const popup of popups) {
      const bounds = popup.getBounds();
      popup.setBounds({
        x: bounds.x + (newBounds.x - lastBounds.x),
        y: bounds.y + (newBounds.y - lastBounds.y),
        width: bounds.width,
        height: bounds.height,
      });
    }
    lastBounds = newBounds;
  })
  win.webContents.on('did-create-window', (window, details) => {
    window.excludedFromShownWindowsMenu = true;
    popups.add(window);
  })
  win.loadURL('http://localhost/gap-year/');
  win.on('closed', () => windows.delete(win));
  windows.add(win);
  if (!focusedWindow)
    return;
  focusedWindow.addTabbedWindow(win);
}
app.on('new-window-for-tab', () => {
  makeWindow();
});


const overrides = {
  ...handler,
  async beep() {
    require('electron').shell.beep();
  },
  async closeAllPopups() {
    for (const popup of popups)
      popup.destroy();
    popups.clear();
  },
  setProgress({progress}, client, sender) {
    BrowserWindow.fromWebContents(sender).setProgressBar(progress);
  },
  async contextMenu({ menuItems }, client, sender) {
    let resolve;
    /**
     * @return {Electron.MenuItemConstructorOptions}
     */
    function convertItem(item) {
      if (!item.title)
        return {type: 'separator'};
        console.log(item.checked);
      return {
        label: item.title,
        click: item.callback ? () => {
          resolve(item.callback)
        } : undefined,
        submenu: item.submenu ? item.submenu.map(convertItem) : undefined,
        checked: item.checked,
        type: item.checked ? 'checkbox' : undefined,
      }
    }
    const menu = Menu.buildFromTemplate(menuItems.map(convertItem));
    const promise = new Promise(x => resolve = x);
    menu.popup(BrowserWindow.fromWebContents(sender));
    const id = await promise;
    return {id};
  }
};

const clients = new WeakMap();
ipcMain.handle('message', async (event, ...args) => {
  const {method, params, id} = args[0];
  if (!overrides.hasOwnProperty(method))
    throw new Error('command not found');
  const result = await overrides[method](params, clientForSender(event.sender), event.sender);
  if (id)
    event.sender.send('message', {result, id});
});

/**
 * @return {import('../host/').Client}
 */
function clientForSender(sender) {
  if (!clients.has(sender)) {
    const client = new (require('events')).EventEmitter();
    client.send = message => sender.send('message', message);
    sender.on('destroyed', () => client.emit('destroyed'));
    sender.on('did-navigate', () => client.emit('destroyed'));
    clients.set(sender, client);
  }  
  return clients.get(sender);
}

app.on('window-all-closed', e => e.preventDefault());
app.on('activate', event => {
  if (windows.size)
    return;
  makeWindow();
});
