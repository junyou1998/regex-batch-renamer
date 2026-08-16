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

function getElectronIpc() {
  if (typeof window === 'undefined') return undefined
  return window.ipcRenderer
}

function inferBrowserPlatform() {
  if (typeof navigator === 'undefined') return 'web'
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    || navigator.platform
    || 'web'
  return platform.toLowerCase().includes('mac') ? 'darwin' : platform
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
    return getElectronIpc()?.selectFiles() ?? []
  },
  async selectDirectory() {
    return getElectronIpc()?.selectDirectory()
  },
  async renameFiles(files: FileOperationRequest[], options?: { failOnExist?: boolean }) {
    const ipc = getElectronIpc()
    if (!ipc) {
      return files.map((file) => ({
        path: file.oldPath,
        success: false,
        error: 'Desktop runtime unavailable in browser preview',
        code: 'UNKNOWN' as const,
      }))
    }
    const results = await ipc.renameFiles(files, options)
    return mapResults(results)
  },
  async copyRenameFiles(files: FileOperationRequest[]) {
    const ipc = getElectronIpc()
    if (!ipc) {
      return files.map((file) => ({
        path: file.oldPath,
        success: false,
        error: 'Desktop runtime unavailable in browser preview',
        code: 'UNKNOWN' as const,
      }))
    }
    const results = await ipc.copyRenameFiles(files)
    return mapResults(results)
  },
  async openExternal(url: string) {
    const ipc = getElectronIpc()
    if (ipc) {
      await ipc.invoke('open-external', url)
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  },
  setZoomFactor(factor: number) {
    getElectronIpc()?.setZoomFactor(factor)
  },
  async getRuntimeInfo(): Promise<DesktopRuntimeInfo> {
    const ipc = getElectronIpc()
    return {
      platform: ipc?.platform ?? inferBrowserPlatform(),
      runtime: 'electron',
      channel: 'stable',
      version: pkg.version,
      appBundlePath: undefined,
      appBundleParentWritable: undefined,
    }
  },
  setPendingChangesHandler(handler: PendingChangesHandler) {
    window.__hasPendingChanges = handler
  },
  clearPendingChangesHandler() {
    delete window.__hasPendingChanges
  },
}
