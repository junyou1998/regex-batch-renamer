import { ipcRenderer, contextBridge, webFrame } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
  // Custom APIs
  selectFiles: () => ipcRenderer.invoke('select-files'),
  renameFiles: (files: { oldPath: string, newPath: string }[]) => ipcRenderer.invoke('rename-files', files),
  copyRenameFiles: (files: { oldPath: string, newPath: string }[]) => ipcRenderer.invoke('copy-rename-files', files),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  platform: process.platform,
  // Zoom APIs
  setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
  getZoomFactor: () => webFrame.getZoomFactor(),
})

