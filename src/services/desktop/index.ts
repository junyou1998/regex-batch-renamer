import type { DesktopBridge } from './types'
import { electronDesktopBridge } from './electron'
import { tauriDesktopBridge } from './tauri'

export function isTauriRuntime() {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

export const desktop: DesktopBridge = isTauriRuntime()
  ? tauriDesktopBridge
  : electronDesktopBridge

export type {
  AppUpdateInfo,
  DesktopBridge,
  DesktopRuntimeInfo,
  FileOperationRequest,
  FileOperationResult,
  ReleaseChannel,
  RuntimeKind,
} from './types'
