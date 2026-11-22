import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { confirm } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { check } from '@tauri-apps/plugin-updater'
import type {
  AiApiProfile,
  AiApiTestResult,
  AiCliStatus,
  AiChatRequest,
  AiChatResponse,
  AppUpdateInfo,
  CopyConflictPolicy,
  DesktopBridge,
  DesktopErrorCode,
  DesktopRuntimeInfo,
  FileDropHandler,
  FileDragStateHandler,
  FileOperationRequest,
  FileOperationResult,
  HttpProxyResponse,
  NativeFileMetadata,
  PendingChangesHandler,
  PendingChangesOptions,
} from './types'

let closeUnlisten: null | (() => void) = null

const KNOWN_ERROR_CODES: DesktopErrorCode[] = [
  'FILE_EXISTS',
  'DUPLICATE_TARGET',
  'PERMISSION_DENIED',
  'INVALID_PATH',
  'NOT_ALLOWED',
  'NOT_FOUND',
  'ROLLED_BACK',
  'IS_DIRECTORY',
]

function normalizeErrorCode(error?: string): FileOperationResult['code'] {
  if (!error) return undefined
  return (KNOWN_ERROR_CODES as string[]).includes(error) ? (error as DesktopErrorCode) : 'UNKNOWN'
}

function mapResults(results: FileOperationResult[]) {
  return results.map((result) => ({
    ...result,
    code: normalizeErrorCode(result.error),
  }))
}

/** Never send a saved key back to Rust; only a key the user is typing right now. */
function profileForBackend(profile: AiApiProfile, includeTypedKey = false) {
  return {
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    apiKey: includeTypedKey ? profile.apiKey?.trim() || '' : '',
    endpoint: profile.endpoint || '',
    model: profile.model || '',
    temperature: profile.temperature,
  }
}

export const tauriDesktopBridge: DesktopBridge = {
  async selectFiles() {
    return invoke<string[]>('select_files')
  },
  async selectDirectory(purpose) {
    const selected = await invoke<string[] | null>('select_directory', { purpose })
    return selected?.[0]
  },
  async selectFolderContents() {
    return (await invoke<string[] | null>('select_directory', { purpose: 'contents' })) ?? []
  },
  async renameFiles(files: FileOperationRequest[]) {
    return mapResults(await invoke<FileOperationResult[]>('rename_files', { files }))
  },
  async copyRenameFiles(files: FileOperationRequest[], onConflict: CopyConflictPolicy = 'skip') {
    return mapResults(await invoke<FileOperationResult[]>('copy_rename_files', { files, onConflict }))
  },
  async readFileBinary(path: string, maxBytes?: number) {
    const buffer = await invoke<ArrayBuffer>('read_file_binary', { path, maxBytes })
    return new Uint8Array(buffer)
  },
  async getFileMetadata(path: string) {
    return invoke<NativeFileMetadata>('get_file_metadata', { path })
  },
  async pluginHttpRequest(request) {
    return invoke<HttpProxyResponse>('plugin_http_request', { request })
  },
  async fetchRemoteText(url: string) {
    return invoke<string>('fetch_remote_text', { url })
  },
  async fetchRemoteBytes(url: string) {
    const buffer = await invoke<ArrayBuffer>('fetch_remote_bytes', { url })
    return new Uint8Array(buffer)
  },
  async confirmDialog(message, options) {
    return confirm(message, {
      title: options?.title,
      okLabel: options?.okLabel,
      cancelLabel: options?.cancelLabel,
      kind: options?.kind ?? 'warning',
    })
  },
  async openExternal(url: string) {
    await openUrl(url)
  },
  async setZoomFactor(factor: number) {
    await invoke('set_zoom_factor', { factor })
  },
  async getRuntimeInfo() {
    return invoke<DesktopRuntimeInfo>('runtime_info')
  },
  async setPendingChangesHandler(handler: PendingChangesHandler, options?: PendingChangesOptions) {
    if (closeUnlisten) {
      closeUnlisten()
      closeUnlisten = null
    }

    try {
      closeUnlisten = await getCurrentWindow().onCloseRequested(async (event) => {
        const hasPending = await handler()
        if (!hasPending) return
        event.preventDefault()
        const confirmed = await confirm(options?.message || '', {
          title: options?.title,
          kind: 'warning',
          okLabel: options?.okLabel,
          cancelLabel: options?.cancelLabel,
        })
        if (confirmed) {
          try {
            await invoke('exit_app')
          } catch {
            await getCurrentWindow().destroy()
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
    // Rust registers dropped paths in its filesystem scope first, then emits
    // this event, so the paths are always usable by the time we get them.
    return listen<string[]>('app://files-dropped', (event) => {
      const paths = (event.payload || []).map(String).filter(Boolean)
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
      if (!update) return { available: false }
      return { available: true, version: update.version }
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
  async testAiApiConnection(profile: AiApiProfile): Promise<AiApiTestResult> {
    return invoke<AiApiTestResult>('test_ai_api_connection', { profile: profileForBackend(profile, true) })
  },
  async listAiModels(profile: AiApiProfile): Promise<string[]> {
    return invoke<string[]>('list_ai_models', { profile: profileForBackend(profile, true) })
  },
  async runAiApiChat(request: AiChatRequest, profile: AiApiProfile): Promise<AiChatResponse> {
    return invoke<AiChatResponse>('run_ai_api_chat', { request, profile: profileForBackend(profile) })
  },
  async cancelAiChat(taskId: string): Promise<boolean> {
    return invoke<boolean>('cancel_ai_chat', { taskId })
  },
  async setAiSecret(profileId: string, apiKey: string) {
    await invoke('set_ai_secret', { profileId, apiKey })
  },
  async deleteAiSecret(profileId: string) {
    await invoke('delete_ai_secret', { profileId })
  },
  async listAiSecretIds() {
    return invoke<string[]>('list_ai_secret_ids')
  },
  async saveTextFile(content: string, options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) {
    return invoke<string | null>('save_text_file', {
      content,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    })
  },
}
