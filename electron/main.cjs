// Electron wrapper. Steam launches a native executable, and a bare .html file
// is not one — this puts the game in a real desktop window so it can ship.
//
// Deliberately .cjs: package.json sets "type": "module", which would otherwise
// make Electron treat this file as ESM. The main process is simplest in CJS.
const { app, BrowserWindow, globalShortcut } = require('electron')
const path = require('node:path')

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    useContentSize: true,
    backgroundColor: '#0b0d0f',
    autoHideMenuBar: true,
    title: 'Home Invasion 3D',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,   // keep the sim running when unfocused
    },
  })

  win.setMenuBarVisibility(false)
  win.loadFile(path.join(__dirname, '..', 'index.html'))

  // F11 fullscreen, the usual Steam-game convention
  globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => globalShortcut.unregisterAll())
