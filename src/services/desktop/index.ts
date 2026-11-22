import type { DesktopBridge } from './types'
import { tauriDesktopBridge } from './tauri'
import { demoDesktopBridge } from '../../dev/demoBridge'

export function isTauriRuntime() {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

// `pnpm demo` swaps in an in-memory bridge; the constant is replaced at build
// time so production bundles never contain the demo code.
export const desktop: DesktopBridge = import.meta.env.VITE_DEMO_MODE === '1' ? demoDesktopBridge : tauriDesktopBridge

export type {
  AppUpdateInfo,
  DesktopBridge,
  DesktopRuntimeInfo,
  FileOperationRequest,
  FileOperationResult,
  ReleaseChannel,
  RuntimeKind,
} from './types'
