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
  win.webContents.setWindowOpenHandler(() => {
    return {
      action: 'allow', 
      overrideBrowserWindowOptions: {
        vibrancy: 'tooltip',
        transparent: true,
        frame: false,
        focusable: false,
        alwaysOnTop: true,
        resizable: false,
        movable: false,
        height: 200,
        width: 150,
      }
    };
  });
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
}

ipcMain.handle('message', async (event, ...args) => {
  const {method, params, id} = args[0];
  if (!handler.hasOwnProperty(method))
    throw new Error('command not found');
  const result = await handler[method](params, event.sender);
  event.sender.send('message', {result, id});
});