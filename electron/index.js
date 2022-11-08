process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
const { app, BrowserWindow, ipcMain, Menu, MenuItem, BrowserView } = require('electron');
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

/** @type {WeakMap<import('electron').WebContents, Map<string, BrowserView>>} */
const browserViews = new WeakMap();
/** @type {WeakMap<import('electron').WebContents, {uuid: string, parent: import('electron').WebContents}>} */
const browserViewContentsToParentContents = new WeakMap();
/** @type {{[key: string]: (params: any, client: import('../host/').Client, sender: import('electron').WebContents) => any}} */
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
  },
  async close(_, client, sender) {
    BrowserWindow.fromWebContents(sender).close();
  },

  // BrowserView api
  createBrowserView(uuid, client, sender) {
    const window = BrowserWindow.fromWebContents(sender);
    const browserView = new BrowserView({
      webPreferences: {
        preload: __dirname + '/browserView-preload.js',
      },
    });
    window.addBrowserView(browserView);
    if (!browserViews.has(sender))
      browserViews.set(sender, new Map());
    const views = browserViews.get(sender);
    browserViewContentsToParentContents.set(browserView.webContents, {uuid, parent: sender});
    // TODO are we leaking browserViews when the sender is destroyed?
    const onParentDestroy = () => {
      console.log('on parent destroy');
      browserView.webContents.destroy();
    };
    browserView.webContents.on('destroyed', () => {
      console.log('browserView destroyed');
      client.off('destroyed', onParentDestroy);
      browserViewContentsToParentContents.delete(browserView.webContents);
      views.delete(uuid);
    });

    client.on('destroyed', onParentDestroy);
    views.set(uuid, browserView);
  },
  focusBrowserView({uuid}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.webContents.focus();
  },
  focusMainContent(_, client, sender) {
    sender.focus();
  },
  destroyBrowserView({uuid}, client, sender) {
    const views = browserViews.get(sender);
    const window = BrowserWindow.fromWebContents(sender);
    const view = views.get(uuid);
    window.removeBrowserView(view);
    view.webContents.destroy();
  },
  postBrowserViewMessage({uuid, message}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.webContents.send('postMessage', message);
  },
  setBrowserViewRect({uuid, rect}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.setBounds({
      x: Math.floor(rect.x),
      y: Math.floor(rect.y),
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
    });
  },
  setBrowserViewURL({uuid, url}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.webContents.loadURL(url);
  },
  attachToCDP({browserViewUUID}, client, sender) {
    const webContents = browserViewUUID ? browserViews.get(sender)?.get(browserViewUUID)?.webContents : sender;
    if (!webContents)
      throw new Error('Could not attach to web content. Maybe it was destroyed?');
    if (webContents.debugger.isAttached())
      throw new Error('A debugger is already attached.');
    webContents.debugger.attach();
    const onDetach = (event, reason) => {
      close();
    };
    const onMessage = (event, method, params, sessionId) => {
      client.send({ method: 'messageFromCDP', params: { browserViewUUID, message: { method, params, sessionId } } });
    };
    const onWebContentsDestroyed = () => {
      close();
    };
    webContents.debugger.on('detach', onDetach);
    webContents.debugger.on('message', onMessage);
    client.on('destroyed', onWebContentsDestroyed);

    function close() {
      webContents.debugger.off('detach', onDetach);
      webContents.debugger.off('message', onMessage);
      webContents.debugger.detach();
    }
  },
  detachFromCDP({browserViewUUID}, client, sender) {
    const webContents = browserViewUUID ? browserViews.get(sender)?.get(browserViewUUID)?.webContents : sender;
    if (!webContents)
      throw new Error('Could not detach from web content. Maybe it was already destroyed?');
    if (!webContents.debugger.isAttached())
      throw new Error('No debugger is attached.');
    webContents.debugger.detach();
    // this calls the cleanup code in attachToCDP via on('detach')
  },
  async sendMessageToCDP({browserViewUUID, message}, client, sender) {
    const webContents = browserViewUUID ? browserViews.get(sender)?.get(browserViewUUID)?.webContents : sender;
    if (!webContents)
      throw new Error('Could not send message to web content. Maybe it was destroyed?');
    if (!webContents.debugger.isAttached())
      throw new Error('No debugger is attached.');

    const {sessionId, method, params, id} = message;
    try {
      const result = await webContents.debugger.sendCommand(method, params, sessionId);
      client.send({ method: 'messageFromCDP', params: { browserViewUUID, message: { id, result, sessionId } } });
    } catch (error) {
      client.send({ method: 'messageFromCDP', params: { browserViewUUID, message: { id, error, sessionId } } });
    }
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
ipcMain.handle('browserView-postMessage', async (event, message) => {
  if (message.method === 'openDevTools') {
    event.sender.openDevTools({
      mode: 'detach',
      activate: true,
    });
  } else {
    const {parent, uuid} = browserViewContentsToParentContents.get(event.sender);
    parent.send('message', { method: 'browserView-message', params: {uuid, message} });
  }
});
/**
 * @param {import('electron').WebContents} sender
 * @return {import('../host/').Client}
 */
function clientForSender(sender) {
  if (!clients.has(sender)) {
    const client = new (require('events')).EventEmitter();
    client.send = message => sender.send('message', message);
    sender.on('destroyed', () => client.emit('destroyed'));
    sender.on('did-frame-navigate', (event, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) => {
      if (isMainFrame)
        client.emit('destroyed');
    });
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
