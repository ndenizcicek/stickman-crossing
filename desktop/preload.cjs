// Exposes a tiny, fixed API to the game page as `window.steam` (see src/platform.ts).
// The page itself has no Node or Electron access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('steam', {
  unlockAchievement: id => ipcRenderer.send('steam:achievement', String(id)),
  setFullscreen: on => ipcRenderer.send('window:fullscreen', !!on),
  isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
  quit: () => ipcRenderer.send('app:quit'),
});
