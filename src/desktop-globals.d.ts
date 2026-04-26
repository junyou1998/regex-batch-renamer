import type { PendingChangesHandler } from './services/desktop/types'

declare global {
  interface Window {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
    __hasPendingChanges?: PendingChangesHandler
  }

  interface ImportMetaEnv {
    readonly VITE_RELEASE_CHANNEL?: 'stable' | 'beta'
  }
}

export {}
