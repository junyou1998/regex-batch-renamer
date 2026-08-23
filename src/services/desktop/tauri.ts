import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { confirm, open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { check } from '@tauri-apps/plugin-updater'
import type {
  AiCliStatus,
  AiChatRequest,
  AiChatResponse,
  AppUpdateInfo,
  DesktopBridge,
  DesktopRuntimeInfo,
  FileDropHandler,
  FileDragStateHandler,
  FileOperationRequest,
  FileOperationResult,
  PendingChangesHandler,
  PendingChangesOptions,
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
    await openUrl(url)
  },
  async setZoomFactor(factor: number) {
    await invoke('set_zoom_factor', { factor })
  },
  async getRuntimeInfo() {
    return runtimeInfo()
  },
  async setPendingChangesHandler(handler: PendingChangesHandler, options?: PendingChangesOptions) {
    if (closeUnlisten) {
      closeUnlisten()
      closeUnlisten = null
    }

    try {
      closeUnlisten = await getCurrentWindow().onCloseRequested(async (event) => {
        const hasPending = await handler()
        if (hasPending) {
          event.preventDefault()
          const confirmed = await confirm(
            options?.message || '清單中尚有未套用的檔名變更，確定要關閉視窗並結束應用程式嗎？',
            {
              title: options?.title || '確認退出',
              kind: 'warning',
              okLabel: options?.okLabel || '退出',
              cancelLabel: options?.cancelLabel || '取消',
            }
          )
          if (confirmed) {
            try {
              await invoke('exit_app')
            } catch {
              await getCurrentWindow().destroy()
            }
          }
        }
      })
    } catch (err) {
      console.warn('Failed to register onCloseRequested handler:', err)
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
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        handler(true)
      } else if (event.payload.type === 'leave' || event.payload.type === 'drop') {
        handler(false)
      }
    })
  },
  async checkForAppUpdate(): Promise<AppUpdateInfo | null> {
    try {
      const update = await check()
      if (!update) {
        return { available: false }
      }

      return {
        available: true,
        version: update.version,
      }
    } catch (error) {
      console.warn('Tauri updater check is unavailable', error)
      return null
    }
  },
  async installAppUpdate() {
    await invoke('install_app_update')
  },
  async startDragging() {
    await getCurrentWindow().startDragging()
  },
  async toggleMaximize() {
    await getCurrentWindow().toggleMaximize()
  },
  async openDevTools() {
    await invoke('open_devtools')
  },
  async checkAiCliStatus(provider?: string): Promise<AiCliStatus> {
    return invoke<AiCliStatus>('check_ai_cli_status', { provider })
  },
  async runAiChat(request: AiChatRequest): Promise<AiChatResponse> {
    return invoke<AiChatResponse>('run_ai_chat', { request })
  },
}
