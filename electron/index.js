process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
const { app, BrowserWindow, ipcMain, Menu, MenuItem } = require('electron');
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

let lastShellId = 0;
/** @type {Map<number, import('../shell/shell').Shell>} */
const shells = new Map();
const handler = {
  async runCommand({shellId, command}) {
    await shells.get(shellId).runCommand(command);
  },
  async evaluate({shellId, code}) {
    return shells.get(shellId).evaluate(code);
  },
  async resize({cols, rows, shellId}) {
    shells.get(shellId).shell.resize(cols, rows);
  },
  async sendRawInput({shellId, input}) {
    shells.get(shellId).sendRawInput(input);
  },
  async createShell(_, sender) {
    const shellId = ++lastShellId;
    const shell = new (require('../shell/shell').Shell)();
    shells.set(shellId, shell);
    shell.on('data', data => {
      sender.send('message', {method: 'data', params: {shellId, data}});
    });
    sender.on('destroyed', () => {
      shell.close();
      shells.delete(shellId);
    })
    return shellId;
  },
  async getHistory() {
    const fs = require('fs');
    const path = require('path');
    try {
      const content = await fs.promises.readFile(path.join(__dirname, '..', '.history'), 'utf8');
      return content.split('\n').filter(x => x).map(x => JSON.parse(x));
    } catch {
      return [];
    }
  },
  async addHistory(item) {
    const fs = require('fs');
    const path = require('path');
    await fs.promises.writeFile(path.join(__dirname, '..', '.history'), JSON.stringify(item) + '\n', {flag: 'a'}); 
  },
  async beep() {
    require('electron').shell.beep();
  },
  async closeAllPopups() {
    for (const popup of popups)
      popup.destroy();
    popups.clear();
  }
}

ipcMain.handle('message', async (event, ...args) => {
  const {method, params, id} = args[0];
  if (!handler.hasOwnProperty(method))
    throw new Error('command not found');
  const result = await handler[method](params, event.sender);
  event.sender.send('message', {result, id});
});