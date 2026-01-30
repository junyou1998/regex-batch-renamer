const electron = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')

console.log('ELECTRON REQUIRE:', electron)
const { app, BrowserWindow, ipcMain, dialog, nativeImage } = electron

// The built directory structure
// In packaged app: app.asar contains both dist and dist-electron
// We need to go from dist-electron (where main.cjs is) to dist folder
if (app.isPackaged) {
  // In production, __dirname is inside app.asar/dist-electron
  // We need to go up one level to app.asar, then into dist
  process.env.DIST = path.join(path.dirname(__dirname), 'dist')
} else {
  // In development, __dirname is in project/dist-electron
  process.env.DIST = path.join(__dirname, '../dist')
}
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: any

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
    width: 1200,
    height: 800,
    // macOS specific settings
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset',
      vibrancy: 'under-window',
      visualEffectState: 'active',
    } : {
      // Windows/Linux settings
      titleBarStyle: 'default',
      autoHideMenuBar: true,
    }),
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Window close protection
  let isClosing = false
  win.on('close', (e: any) => {
    if (isClosing) return // Already handling close

    e.preventDefault()
    isClosing = true

    // Async check for pending changes
    win.webContents.executeJavaScript(
      `window.__hasPendingChanges ? window.__hasPendingChanges() : false`
    ).then((hasPendingChanges: boolean) => {
      if (hasPendingChanges) {
        dialog.showMessageBox(win, {
          type: 'warning',
          buttons: ['取消', '確定關閉'],
          defaultId: 0,
          cancelId: 0,
          title: '確認關閉',
          message: '您有尚未執行的更名變更',
          detail: '關閉視窗將會遺失這些變更，確定要關閉嗎？'
        }).then(({ response }: { response: number }) => {
          if (response === 1) {
            win.destroy()
          } else {
            isClosing = false
          }
        })
      } else {
        win.destroy()
      }
    }).catch(() => {
      // On error, allow close
      win.destroy()
    })
  })

  // Open DevTools only in development
  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools()
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // In production, load from dist folder
    const indexPath = path.join(process.env.DIST || '', 'index.html')
    win.loadFile(indexPath)
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const iconPath = path.join(process.env.VITE_PUBLIC || '', 'icon-mac.png')
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }
  createWindow()

  // IPC Handlers
  ipcMain.handle('select-files', async () => {
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections']
    })
    return result.filePaths
  })

  ipcMain.handle('rename-files', async (_event: any, files: any[], options?: { failOnExist?: boolean }) => {
    const results = []
    for (const file of files) {
      // If paths are identical, it's a no-op success (avoids self-collision check)
      if (file.oldPath === file.newPath) {
        results.push({ path: file.oldPath, success: true })
        continue
      }

      try {
        if (options?.failOnExist) {
          try {
            await fs.access(file.newPath)
            // If access succeeds, file exists
            throw new Error('FILE_EXISTS')
          } catch (e: any) {
            if (e.message === 'FILE_EXISTS') throw e
            // If access fails (ENOENT), file does not exist, safe to proceed
          }
        }
        await fs.rename(file.oldPath, file.newPath)
        results.push({ path: file.oldPath, success: true })
      } catch (error: any) {
        results.push({ path: file.oldPath, success: false, error: error.message })
      }
    }
    return results
  })

  ipcMain.handle('copy-rename-files', async (_event: any, files: any[]) => {
    const results = []
    for (const file of files) {
      try {
        await fs.copyFile(file.oldPath, file.newPath)
        results.push({ path: file.oldPath, success: true })
      } catch (error: any) {
        results.push({ path: file.oldPath, success: false, error: error.message })
      }
    }
    return results
  })

  ipcMain.handle('select-directory', async () => {
    if (!win) return undefined
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    return result.filePaths[0]
  })

  ipcMain.handle('open-external', async (_event: any, url: string) => {
    await electron.shell.openExternal(url)
  })
})
