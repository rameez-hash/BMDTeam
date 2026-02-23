const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
let mainWindow;
let tray;

// Always use Vercel production URL
const API_URL = 'https://hrms.bmdhouse.com';

// Icon path: use resourcesPath in packaged app, __dirname in dev
function getIconPath(filename) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, filename);
  }
  return path.join(__dirname, 'assets', filename);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 620,
    height: 700,
    minWidth: 500,
    minHeight: 500,
    resizable: true,
    frame: false,
    transparent: false,
    backgroundColor: '#0b0f19',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: getIconPath('iconbmd.ico'),
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('maximize-change', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('maximize-change', false);
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = getIconPath('iconbmd.ico');
  
  // Create a simple icon if file doesn't exist
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
  } catch {
    icon = nativeImage.createEmpty();
  }
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open HRMS', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Check In', click: () => sendToRenderer('quick-action', 'check-in') },
    { label: 'Check Out', click: () => sendToRenderer('quick-action', 'check-out') },
    { label: 'Start Break', click: () => sendToRenderer('quick-action', 'break-start') },
    { label: 'End Break', click: () => sendToRenderer('quick-action', 'break-end') },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      app.isQuitting = true;
      app.quit();
    }},
  ]);
  
  tray.setToolTip('HRMS Desktop');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

function sendToRenderer(channel, data) {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.webContents.send(channel, data);
  }
}

function showNotification(title, body) {
  new Notification({ title, body }).show();
}

// IPC Handlers
ipcMain.handle('get-store', (_, key) => store.get(key));
ipcMain.handle('set-store', (_, key, value) => {
  store.set(key, value);
  return true;
});
ipcMain.handle('get-api-url', () => API_URL);
ipcMain.handle('show-notification', (_, { title, body }) => {
  showNotification(title, body);
});

ipcMain.on('minimize', () => mainWindow.minimize());
ipcMain.on('maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.handle('is-maximized', () => mainWindow.isMaximized());
ipcMain.on('close', () => mainWindow.hide());
ipcMain.on('open-dashboard', (_, path) => {
  const url = API_URL + (path || '/dashboard');
  shell.openExternal(url);
});

// ── Auto-update (A1: silent download → 5-min countdown → auto-restart) ──
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
let restartTimer = null;

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);
  // Notify renderer to show countdown bar
  if (mainWindow) {
    mainWindow.webContents.send('update-ready', info.version);
  }
  // Auto-restart after 5 minutes
  restartTimer = setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 5 * 60 * 1000);
});

autoUpdater.on('error', (err) => {
  console.error('Auto-update error:', err);
});

// Let renderer request immediate restart
ipcMain.on('install-update-now', () => {
  if (restartTimer) clearTimeout(restartTimer);
  autoUpdater.quitAndInstall(false, true);
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  // Check for updates 3 seconds after launch
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => console.error('Update check failed:', err));
  }, 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
