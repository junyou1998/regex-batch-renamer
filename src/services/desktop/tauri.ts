import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import { check } from '@tauri-apps/plugin-updater'
import type {
  AppUpdateInfo,
  DesktopBridge,
  DesktopRuntimeInfo,
  FileDropHandler,
  FileDragStateHandler,
  FileOperationRequest,
  FileOperationResult,
  PendingChangesHandler,
} from './types'

let closeUnlisten: null | (() => void) = null

function normalizeErrorCode(error?: string): FileOperationResult['code'] {
  if (error === 'FILE_EXISTS') return 'FILE_EXISTS'
  if (error === 'PERMISSION_DENIED') return 'PERMISSION_DENIED'
  if (error === 'INVALID_PATH') return 'INVALID_PATH'
  return error ? 'UNKNOWN' : undefined
}

function mapResults(results: FileOperationResult[]) {
  return results.map((result) => ({
    ...result,
    code: normalizeErrorCode(result.error),
  }))
}

async function runtimeInfo(): Promise<DesktopRuntimeInfo> {
  return invoke<DesktopRuntimeInfo>('runtime_info')
}

export const tauriDesktopBridge: DesktopBridge = {
  async selectFiles() {
    const selected = await open({
      multiple: true,
      directory: false,
    })

    if (!selected) return []
    return Array.isArray(selected) ? selected.map(String) : [String(selected)]
  },
  async selectDirectory() {
    const selected = await open({
      directory: true,
      multiple: false,
    })

    if (!selected) return undefined
    return Array.isArray(selected) ? String(selected[0]) : String(selected)
  },
  async renameFiles(files: FileOperationRequest[], options?: { failOnExist?: boolean }) {
    const results = await invoke<FileOperationResult[]>('rename_files', {
      files,
      failOnExist: options?.failOnExist ?? false,
    })
    return mapResults(results)
  },
  async copyRenameFiles(files: FileOperationRequest[]) {
    const results = await invoke<FileOperationResult[]>('copy_rename_files', { files })
    return mapResults(results)
  },
  async openExternal(url: string) {
    await openPath(url)
  },
  async setZoomFactor(factor: number) {
    await invoke('set_zoom_factor', { factor })
  },
  async getRuntimeInfo() {
    return runtimeInfo()
  },
  async setPendingChangesHandler(handler: PendingChangesHandler) {
    void handler
    if (closeUnlisten) {
      closeUnlisten()
      closeUnlisten = null
    }
  },
  clearPendingChangesHandler() {
    if (closeUnlisten) {
      closeUnlisten()
      closeUnlisten = null
    }
  },
  async onFilesDropped(handler: FileDropHandler) {
    return getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type !== 'drop') return
      const paths = event.payload.paths.map(String).filter(Boolean)
      if (paths.length > 0) handler(paths)
    })
  },
  async onFileDragStateChanged(handler: FileDragStateHandler) {
    return getCurrentWindow().onDragDropEvent((event) => {
      handler(event.payload.type === 'over')
    })
  },
  async checkForAppUpdate(): Promise<AppUpdateInfo | null> {
    const update = await check()
    if (!update) {
      return { available: false }
    }

    return {
      available: true,
      version: update.version,
    }
  },
  async installAppUpdate() {
    const update = await check()
    if (!update) return
    await update.downloadAndInstall()
  },
}
