process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
const { app, protocol, BrowserWindow, ipcMain, Menu, MenuItem } = require('electron');
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

let lastShellId = 0;
/** @type {Map<number, import('../shell/shell').Shell>} */
const shells = new Map();
let lastWebsocketId = 0;
/** @type {Map<number, import('ws').WebSocket>} */
const websockets = new Map();
const handler = {
  async evaluate({shellId, code}) {
    return shells.get(shellId).evaluate(code);
  },
  async chdir({shellId, dir}) {
    return shells.get(shellId).chdir(dir);
  },
  async env({shellId, env}) {
    return shells.get(shellId).env(env);
  },
  async createShell(_, sender) {
    const shellId = ++lastShellId;
    const shell = new (require('../shell/shell').Shell)();
    shells.set(shellId, shell);
    sender.on('destroyed', destroy);
    sender.on('did-navigate', destroy);

    function destroy() {
      sender.off('destroyed', destroy);
      sender.off('did-navigate', destroy);
      shell.close();
      shells.delete(shellId);    
    }
    return {shellId};
  },
  async createJSShell({cwd}, sender) {
    /** @type {import('child_process').ChildProcessWithoutNullStreams} */
    let child;
    let killed = false;
    sender.on('destroyed', destroy);
    sender.on('did-navigate', destroy);

    function destroy() {
      killed = true;
      sender.off('destroyed', destroy);
      sender.off('did-navigate', destroy);
      websockets.delete(socketId);
      child?.kill();
    }
    const { spawnJSProcess } = require('../shell/spawnJSProcess');
    const result = await spawnJSProcess(cwd);
    child = result.child;
    if (killed)
      child.kill();
    const socketId = ++lastWebsocketId;
    const socket = new (require('ws').WebSocket)(result.url);
    socket.onmessage = event => {
      sender.send('message', { method: 'websocket', params: {socketId, message: event.data}});
    };
    websockets.set(socketId, socket);
    await new Promise(x => socket.onopen = x);
    return { socketId };
  },
  sendMessageToWebSocket({socketId, message}) {
    websockets.get(socketId).send(message);
  },
  destroyWebsocket({socketId}) {
    websockets.get(socketId).close();
    websockets.delete(socketId);
  },
  async getHistory() {
    const util = require('util');
    const database = getDatabase();
    return await util.promisify(database.all.bind(database))('SELECT command FROM history ORDER BY command_id ASC');
  },
  async addHistory(item) {
    const database = getDatabase();
    const runResult = await new Promise((res, rej) => {
      database.run(`INSERT INTO history (command, start) VALUES (?, ?)`, [item.command, item.start], function (err) {
        if (err)
          rej(err)
        else
          res(this);
      });
    });
    return runResult.lastID;;
  },
  async updateHistory({id, col, value}) {
    const database = getDatabase();
    const runResult = await new Promise((res, rej) => {
      database.run(`UPDATE history SET '${col}' = ? WHERE command_id = ?`, [value, id], function (err) {
        if (err)
          rej(err)
        else
          res(this);
      });
    });
    return runResult.changes;
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

let database;
/** @return {import('sqlite3').Database} */
function getDatabase() {
  if (database)
    return database;
  const path = require('path');
  const sqlite3 = require('sqlite3');
  database = new sqlite3.Database(path.join(__dirname, '..', 'history.sqlite3'));
  return database;
}

ipcMain.handle('message', async (event, ...args) => {
  const {method, params, id} = args[0];
  if (!handler.hasOwnProperty(method))
    throw new Error('command not found');
  const result = await handler[method](params, event.sender);
  if (id)
    event.sender.send('message', {result, id});
});

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'remote',
    privileges: {
      stream: true
    }
  }
]);
void app.whenReady().then(() => {
  protocol.registerFileProtocol('local', (request, callback) => {
    const url = new URL(request.url);
    callback({path: url.pathname});
  });
  protocol.registerBufferProtocol('remote', (request, callback) => {
    const url = new URL(request.url);
    /** @type {Buffer[]} */
    const buffers = [];
    const process = require('child_process').spawn('ssh', [
      '-p',
      String(url.port || 22),
      `${url.username}@${url.hostname}`,
      'cat',
      url.pathname
    ]);
    process.stdout.on('data', (d) => buffers.push(d));
    process.on('close', (code) => {
      if (code) {
        callback({statusCode: 404});
        return;
      }
      callback({
        statusCode: 200,
        data: Buffer.concat(buffers),
        mimeType: require('mime-types').lookup(url.pathname) || undefined
      });
    });
  });
});
