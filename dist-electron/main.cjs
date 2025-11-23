"use strict";
const electron = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
console.log("ELECTRON REQUIRE:", electron);
const { app, BrowserWindow, ipcMain, dialog } = electron;
if (app.isPackaged) {
  process.env.DIST = path.join(path.dirname(__dirname), "dist");
} else {
  process.env.DIST = path.join(__dirname, "../dist");
}
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, "../public");
let win;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || "", "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs")
    },
    width: 1200,
    height: 800,
    // macOS specific settings
    ...process.platform === "darwin" ? {
      titleBarStyle: "hiddenInset",
      vibrancy: "under-window",
      visualEffectState: "active"
    } : {
      // Windows/Linux settings
      titleBarStyle: "default",
      autoHideMenuBar: true
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  win.webContents.openDevTools();
  if (VITE_DEV_SERVER_URL) {
    console.log("Loading DEV URL:", VITE_DEV_SERVER_URL);
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(process.env.DIST || "", "index.html");
    console.log("Loading production file:", indexPath);
    console.log("File exists:", require("fs").existsSync(indexPath));
    console.log("DIST path:", process.env.DIST);
    console.log("__dirname:", __dirname);
    console.log("app.isPackaged:", app.isPackaged);
    win.loadFile(indexPath);
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  createWindow();
  ipcMain.handle("select-files", async () => {
    if (!win) return [];
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"]
    });
    return result.filePaths;
  });
  ipcMain.handle("rename-files", async (_event, files) => {
    const results = [];
    for (const file of files) {
      try {
        await fs.rename(file.oldPath, file.newPath);
        results.push({ path: file.oldPath, success: true });
      } catch (error) {
        results.push({ path: file.oldPath, success: false, error: error.message });
      }
    }
    return results;
  });
  ipcMain.handle("copy-rename-files", async (_event, files) => {
    const results = [];
    for (const file of files) {
      try {
        await fs.copyFile(file.oldPath, file.newPath);
        results.push({ path: file.oldPath, success: true });
      } catch (error) {
        results.push({ path: file.oldPath, success: false, error: error.message });
      }
    }
    return results;
  });
  ipcMain.handle("select-directory", async () => {
    if (!win) return void 0;
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"]
    });
    return result.filePaths[0];
  });
});
