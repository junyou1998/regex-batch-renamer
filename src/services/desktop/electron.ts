import type {
  DesktopBridge,
  FileOperationResult,
  DesktopRuntimeInfo,
  FileOperationRequest,
  PendingChangesHandler,
} from './types'
import pkg from '../../../package.json'

declare global {
  interface Window {
    __hasPendingChanges?: PendingChangesHandler
  }
}

function mapResults(
  results: { path: string; success: boolean; error?: string }[],
): FileOperationResult[] {
  return results.map((result) => ({
    ...result,
    code: !result.error
      ? undefined
      : result.error === 'FILE_EXISTS'
        ? 'FILE_EXISTS'
        : 'UNKNOWN',
  }))
}

export const electronDesktopBridge: DesktopBridge = {
  async selectFiles() {
    return window.ipcRenderer.selectFiles()
  },
  async selectDirectory() {
    return window.ipcRenderer.selectDirectory()
  },
  async renameFiles(files: FileOperationRequest[], options?: { failOnExist?: boolean }) {
    const results = await window.ipcRenderer.renameFiles(files, options)
    return mapResults(results)
  },
  async copyRenameFiles(files: FileOperationRequest[]) {
    const results = await window.ipcRenderer.copyRenameFiles(files)
    return mapResults(results)
  },
  async openExternal(url: string) {
    await window.ipcRenderer.invoke('open-external', url)
  },
  setZoomFactor(factor: number) {
    window.ipcRenderer.setZoomFactor(factor)
  },
  async getRuntimeInfo(): Promise<DesktopRuntimeInfo> {
    return {
      platform: window.ipcRenderer.platform,
      runtime: 'electron',
      channel: 'stable',
      version: pkg.version,
    }
  },
  setPendingChangesHandler(handler: PendingChangesHandler) {
    window.__hasPendingChanges = handler
  },
  clearPendingChangesHandler() {
    delete window.__hasPendingChanges
  },
}
