reportTime('electron top');
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
const { app, BrowserWindow, ipcMain, Menu, MenuItem, WebContentsView, protocol, screen } = require('electron');
const { handler, proxies, preloadJSShell, getTheme } = require('../host');
const path = require('path');
const os = require('os');
reportTime('electron requires');
const headless = process.argv.includes('--test-headless');
const forceInteralGlassPane = process.argv.includes('--force-internal-glass-pane');
let windowNumber = 0;
if (headless)
  app.dock?.hide();
if (process.env.SNAIL_TEST_USER_DATA_DIR)
  app.setPath('userData', process.env.SNAIL_TEST_USER_DATA_DIR);
app.setName('snail');
app.commandLine.appendSwitch('enable-features', 'AtomicMoveAPI');
const isDevMode = process.argv.includes('--dev-mode');

if (isDevMode && os.platform() == 'darwin') {
  const nativeImage = require('electron').nativeImage
  const image = nativeImage.createFromPath(path.join(__dirname, '..', 'icon', 'icon.png'))
  app.dock.setIcon(image);
}

/** @type {Set<BrowserWindow>} */
const windows = new Set();
const menu = new Menu();
app.setAboutPanelOptions({
  applicationName: app.name,
  applicationVersion: app.getVersion(),
  website: 'https://github.com/JoelEinbinder/snail/',
  copyright: '© 2023 Joel Einbinder',
  credits: 'xterm.js used under the MIT license\nElectron used under the MIT license\nseti-ui used under the MIT license\n',
});
menu.append(new MenuItem({
  label: app.name,
  submenu: [{
    role: 'about',
  }, {
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

Menu.setApplicationMenu(menu);
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'snail',
    privileges: {
      standard: true,
      allowServiceWorkers: true,
      bypassCSP: false,
      corsEnabled: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
    }
  }
]);
app.whenReady().then(() => {
  reportTime('electon ready');
  protocol.registerBufferProtocol('snail', async (request, callback) => {
    try {
      const {host, search, pathname} = new URL('http://' + request.url.substring('snail:'.length));
      const [socketId, ...shellIds] = host.split('-').slice(1).map(Number);
      const filePath = decodeURIComponent(pathname);
      const out = await proxies.get(socketId).send('Shell.resolveFileForIframe', {shellIds, filePath, search, headers: request.headers});
      if (out.error)
        throw out.error.message;
      const {result: {response}} = out;
      const headers = response.headers || {};

      callback({
        data: response.data !== undefined ? Buffer.from(response.data, 'base64') : undefined,
        statusCode: response.statusCode,
        mimeType: response.mimeType,
        headers,
      });
    } catch (e) {
      console.error(e);
      callback({
        statusCode: 500,
        data: Buffer.from(String(e), 'utf8'),
      });
    }
  });
  if (!process.argv.includes('--no-first-window'))
    makeWindow();
});
/** @type {BrowserWindow} */
let popup = null;
async function makeWindow() {
  reportTime('start make window');
  preloadJSShell();
  const focusedWindow = [...windows].find(x => {
    try {
      // sometimes the close event is late and this throws
      return x.isFocused();
    } catch {
      return false;
    }
  });
  const theme = await getTheme();
  const win = new BrowserWindow({
    width: 490,
    height: 371,
    minHeight: 130,
    minWidth: 200,
    title: 'snail',
    tabbingIdentifier: (++windowNumber).toString(),
    webPreferences: {
      preload: __dirname + '/preload.js',
    },
    backgroundColor: theme === 'dark' ? '#000' : '#FFF',
    show: !headless,
    skipTaskbar: headless,
    icon: os.platform() === 'darwin' ? undefined : path.join(__dirname, '128.png'),

    // linux options
    autoHideMenuBar: true,
    darkTheme: theme === 'dark',
    frame: os.platform() === 'darwin',
  });
  win.on('maximize', () => {
    clientForSender(win.webContents).send({ method: 'maximizeStateChanged', params: { maximized: true }});
  });
  win.on('unmaximize', () => {
    clientForSender(win.webContents).send({ method: 'maximizeStateChanged', params: { maximized: false }});
  });

  win.webContents.setWindowOpenHandler(details => {
    if (details.features.includes('width=')) {
      return {
        action: 'allow', 
        overrideBrowserWindowOptions: {
          transparent: true,
          roundedCorners: false,
          frame: false,
          focusable: false,
          hasShadow: false,
          height: 0,
          width: 0,
          type: 'panel',
          parent: win,
          show: !headless,
        }
      };
    }
    require('electron').shell.openExternal(details.url);
    return { action: 'deny' };
  });
  let lastBounds = win.getBounds();
  win.on('move', () => {
    const newBounds = win.getBounds();
    const bounds = popup?.getBounds();
    popup?.setBounds({
      x: bounds.x + (newBounds.x - lastBounds.x),
      y: bounds.y + (newBounds.y - lastBounds.y),
      width: bounds.width,
      height: bounds.height,
    });
    lastBounds = newBounds;
  })
  win.webContents.on('did-create-window', (window, details) => {
    if (details.options.type !== 'panel')
      return;
    window.setOpacity(0);
    window.excludedFromShownWindowsMenu = true;
    window.setAlwaysOnTop(true, 'pop-up-menu');
    if (popup)
      popup.destroy();
    popup = window;
    window.once('closed', () => {
      if (window !== popup)
        return;
      popup = null;
    });
  })
  if (isDevMode) {
    require('../electron-dev/').createDevServer().then(({url}) => {
      const parsed = new URL(url);
      parsed.searchParams.set('theme', theme);
      if (forceInteralGlassPane)
        parsed.searchParams.set('forceInteralGlassPane', forceInteralGlassPane);
      return win.loadURL(parsed.toString());
    });
  } else if (process.env.SNAIL_DEBUG_URL) {
    const parsed = new URL(process.env.SNAIL_DEBUG_URL);
    parsed.searchParams.set('theme', theme);
    if (forceInteralGlassPane)
      parsed.searchParams.set('forceInteralGlassPane', forceInteralGlassPane);
    win.loadURL(parsed.toString());
  } else {
    win.loadFile(path.join(__dirname, 'index.html'), { query: { theme, forceInteralGlassPane } });
  }
  win.on('closed', () => windows.delete(win));
  windows.add(win);
  reportTime('make window');
  if (!focusedWindow)
    return;
  focusedWindow.addTabbedWindow?.(win);
}
app.on('new-window-for-tab', () => {
  makeWindow();
});

/** @type {WeakMap<import('electron').WebContents, Map<string, import('electron').WebContentsView>>} */
const browserViews = new WeakMap();
/** @type {WeakMap<import('electron').WebContents, {uuid: string, parent: import('electron').WebContents}>} */
const browserViewContentsToParentContents = new WeakMap();
/** @typedef {import('../host/ShellHost').ShellHost} ShellHost */
/** @type {{[Key in keyof ShellHost]?: (params: Parameters<ShellHost[Key]>[0], client: import('../host/').Client, sender: import('electron').WebContents) => ReturnType<ShellHost[Key]>|Promise<ReturnType<ShellHost[Key]>>}} */
const overrides = {
  ...handler,
  async beep() {
    if (headless)
      return;
    require('electron').shell.beep();
  },
  async destroyPopup() {
    popup?.destroy();
    popup = null;
  },
  async resizePanel({width, height}, client, sender) {
    popup?.setBounds({
      height,
      width,
    });
  },
  async positionPanel({bottom, top, x}, client, sender) {
    if (!popup)
      throw new Error('No popup to position');
    const window = BrowserWindow.fromWebContents(sender);
    const windowBounds = window.getContentBounds();
    top = windowBounds.y + top * sender.zoomFactor;
    bottom = windowBounds.y + bottom * sender.zoomFactor;
    x = windowBounds.x + x * sender.zoomFactor;
    const display = screen.getDisplayMatching(windowBounds);
    const popupBounds = popup.getBounds();
    const overflowBottom = bottom + popupBounds.height - display.bounds.y - display.bounds.height;
    const overflowTop = (top + popupBounds.height ) - (display.bounds.y + display.bounds.height) + display.bounds.y;
    const positionAtBottom = (overflowBottom <= 0 || overflowBottom < overflowTop)
    popup.setBounds({
      x: x,
      y: positionAtBottom ? (bottom) : (top - popupBounds.height),
    });
    popup.setOpacity(1);
    return positionAtBottom;
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
        enabled: item.enabled,
        accelerator: item.accelerator,
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
  async captureImage({ rect }, client, sender) {
    const image = await sender.capturePage(rect, {});
    const data = image.toDataURL();
    return { data };
  },
  async minimize(_, client, sender) {
    BrowserWindow.fromWebContents(sender).minimize();
  },
  async setMaximized({maximized}, client, sender) {
    if (maximized)
      BrowserWindow.fromWebContents(sender).maximize();
    else
      BrowserWindow.fromWebContents(sender).unmaximize();
  },

  // BrowserView api
  createBrowserView(uuid, client, sender) {
    const window = BrowserWindow.fromWebContents(sender);
    const browserView = new WebContentsView({
      webPreferences: {
        preload: __dirname + '/browserView-preload.js',
        zoomFactor: sender.zoomFactor,
      },
    });
    browserView.setBackgroundColor('#00000000');
    window.contentView.addChildView(browserView);
    if (!browserViews.has(sender))
      browserViews.set(sender, new Map());
    const views = browserViews.get(sender);
    browserViewContentsToParentContents.set(browserView.webContents, {uuid, parent: sender});
    // TODO are we leaking browserViews when the sender is destroyed?
    const onParentDestroy = () => {
      window.contentView.removeChildView(browserView);
      browserView.webContents.destroy();
    };
    browserView.webContents.on('destroyed', () => {
      client.off('destroyed', onParentDestroy);
      browserViewContentsToParentContents.delete(browserView.webContents);
      views.delete(uuid);
    });

    client.on('destroyed', onParentDestroy);
    views.set(uuid, browserView);
    browserView.webContents.on('did-frame-navigate', (event, url, httpResponseCode, httpStatusText, isMainFrame, frameProcessId, frameRoutingId) => {
      if (!isMainFrame)
        return;
      sender.send('message', {
        method: 'browserView-message',
        params: {
          uuid,
          trusted: true,
          message: {
            method: 'did-navigate', params: {
              url,
              canGoBack: browserView.webContents.navigationHistory.canGoBack(),
              canGoForward: browserView.webContents.navigationHistory.canGoForward(),
            }
          }
        }
      });
    });
    browserView.webContents.on('page-title-updated', (event, title) => {
      sender.send('message', {
        method: 'browserView-message',
        params: {
          uuid,
          trusted: true,
          message: { method: 'page-title-updated', params: { title } }
        }
      });
    });
    browserView.webContents.on('input-event', (event, inputEvent) => {
      if (inputEvent.type !== 'rawKeyDown')
        return;
      sender.send('message', {
        method: 'browserView-message',
        params: {
          uuid,
          trusted: true,
          message: { method: 'input-event', params: inputEvent }
        }
      });      
    })
  },
  focusBrowserView({uuid}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.webContents.focus();
  },
  focusMainContent(_, client, sender) {
    if (BrowserWindow.fromWebContents(sender).isFocused())
      sender.focus();
  },
  destroyBrowserView({uuid}, client, sender) {
    const views = browserViews.get(sender);
    const window = BrowserWindow.fromWebContents(sender);
    const view = views.get(uuid);
    window.contentView.removeChildView(view);
    view.webContents.destroy();
  },
  postBrowserViewMessage({uuid, message}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.webContents.send('postMessage', message);
  },
  setBrowserViewRect({uuid, rect}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.setBounds({
      x: Math.floor(rect.x * sender.zoomFactor),
      y: Math.floor(rect.y * sender.zoomFactor),
      width: Math.ceil(rect.width * sender.zoomFactor),
      height: Math.ceil(rect.height * sender.zoomFactor),
    });
  },
  setBrowserViewURL({uuid, url}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.webContents.loadURL(url);
  },
  refreshBrowserView({uuid}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.webContents.reloadIgnoringCache();
  },
  backBrowserView({uuid}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.webContents.navigationHistory.goBack();
  },
  forwardBrowserView({uuid}, client, sender) {
    browserViews.get(sender)?.get(uuid)?.webContents.navigationHistory.goForward();
  },
  hideBrowserView({uuid}, client, sender) {
    const window = BrowserWindow.fromWebContents(sender);
    const view = browserViews.get(sender)?.get(uuid);
    const focused = view.webContents.isFocused();
    window.contentView.removeChildView(view);
    if (view)
      window.webContents.setZoomFactor(view.webContents.zoomFactor);
    if (focused)
      sender.focus();
  },
  showBrowserView({uuid}, client, sender) {
    const window = BrowserWindow.fromWebContents(sender);
    const view = browserViews.get(sender)?.get(uuid);
    if (!view)
      return;
    window.contentView.addChildView(view);
    view.webContents.setZoomFactor(sender.zoomFactor);
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
      client.off('destroyed', onWebContentsDestroyed);
      webContents.debugger.off('detach', onDetach);
      webContents.debugger.off('message', onMessage);
      webContents.debugger.detach();
    }
  },
  detachFromCDP({browserViewUUID} = {}, client, sender) {
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
  },
  requestInspect({uuid}, client, sender) {
    const webContents = uuid ? browserViews.get(sender)?.get(uuid)?.webContents : sender;
    webContents.openDevTools({
      mode: 'detach',
      activate: true
    });
  },

  async urlForIFrame({shellIds, filePath}) {
    const url = new URL(`http://shell-${shellIds.join('-')}`);
    url.pathname = filePath;
    url.search = '?entry';
    return 'snail://' + url.href.substring('http://'.length);;
  },

  switchToTab({tabNumber}, client, sender) {
    BrowserWindow.getAllWindows()[BrowserWindow.getAllWindows().length - tabNumber - 1]?.focus();
  }
};

const clients = new WeakMap();
ipcMain.handle('message', async (event, ...args) => {
  const {method, params, id} = args[0];
  if (!overrides.hasOwnProperty(method))
    throw new Error('command not found: ' + method);
  try {
    if (id)
      reportTime('start ' + method);
    const result = await overrides[method](params, clientForSender(event.sender), event.sender);
    if (id)
      reportTime('end ' + method)
    if (result && result[Symbol.asyncIterator]) {
      for await (const streamingResult of result) {
        if (id)
          event.sender.send('message', {streamingResult, id});
      }
      event.sender.send('message', { id, streamingDone: true });
    } else {
      if (id)
        event.sender.send('message', {result, id});
    }
  } catch (error) {
    if (id)
      event.sender.send('message', {error: error.stack, id});
    else
      throw error;
  }
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
    sender.on('did-frame-navigate', (event, url, httpResponseCode, httpStatusText, isMainFrame, frameProcessId, frameRoutingId) => {
      if (isMainFrame)
        client.emit('destroyed');
    });
    clients.set(sender, client);
  }  
  return clients.get(sender);
}

app.on('window-all-closed', e => {
  if (process.argv.includes('--no-first-window') || os.platform() === 'darwin') {
    e.preventDefault();
    return;
  }
  app.quit();
});
app.on('activate', event => {
  if (windows.size)
    return;
  makeWindow();
});


function reportTime(name) {
  if (parseInt(process.env.SNAIL_TIME_STARTUP))
    console.log(`Time: ${name}`);
}

// For tests
global.makeWindow = makeWindow;
