"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  },
  // Custom APIs
  selectFiles: () => electron.ipcRenderer.invoke("select-files"),
  renameFiles: (files) => electron.ipcRenderer.invoke("rename-files", files),
  copyRenameFiles: (files) => electron.ipcRenderer.invoke("copy-rename-files", files),
  selectDirectory: () => electron.ipcRenderer.invoke("select-directory"),
  platform: process.platform
});
