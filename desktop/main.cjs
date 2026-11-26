// Electron main process for the Steam build (Windows, Linux / Steam Deck).
// Loads the same web build (dist/) as the browser and phone versions, and talks to Steam through steamworks.js.
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

// ---------- Steam ----------
// The App ID comes from desktop/steam_appid.txt (480 = Valve's "Spacewar" test app until the real one exists).
// When the game is started from the Steam client, Steam supplies the App ID itself.
function readAppId() {
  for (const p of [path.join(__dirname, 'steam_appid.txt'), path.join(process.resourcesPath || '', 'steam_appid.txt')]) {
    try { const id = parseInt(fs.readFileSync(p, 'utf8').trim(), 10); if (id > 0) return id; } catch { /* next */ }
  }
  return undefined;
}

let steam = null;
let steamworks = null;
try {
  steamworks = require('steamworks.js');
  const appId = readAppId();
  // A release build started outside Steam relaunches itself through Steam (required for achievements and DRM-free
  // launches alike). Skipped for the test App ID and while developing.
  if (app.isPackaged && appId && appId !== 480 && steamworks.restartAppIfNecessary(appId)) {
    app.exit(0);
  }
  steam = steamworks.init(appId);
} catch (err) {
  // Steam not running or steamworks.js missing: the game still works, achievements are simply skipped.
  console.warn('[steam] not available:', err && err.message);
}

ipcMain.on('steam:achievement', (_e, id) => {
  try {
    if (steam && typeof id === 'string' && /^[A-Z0-9_]{1,64}$/.test(id) && !steam.achievement.isActivated(id)) {
      steam.achievement.activate(id);
    }
  } catch (err) { console.warn('[steam] achievement failed:', id, err && err.message); }
});

// ---------- window ----------
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 640,
    backgroundColor: '#e3e9ee',
    title: 'Crosswalk Crew',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // Links (e.g. none today, but future store/credits links) open in the system browser, never inside the game.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
}

ipcMain.on('window:fullscreen', (_e, on) => { if (win) win.setFullScreen(!!on); });
ipcMain.handle('window:isFullscreen', () => !!(win && win.isFullScreen()));
ipcMain.on('app:quit', () => app.quit());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// Steam overlay (Shift+Tab) inside the Electron window. Must run in the main process at startup.
if (steamworks) {
  try { steamworks.electronEnableSteamOverlay(); } catch (err) { console.warn('[steam] overlay unavailable:', err && err.message); }
}
