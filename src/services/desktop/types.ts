export type ReleaseChannel = 'stable' | 'beta'
export type RuntimeKind = 'electron' | 'tauri'

export type DesktopErrorCode =
  | 'FILE_EXISTS'
  | 'PERMISSION_DENIED'
  | 'INVALID_PATH'
  | 'UNKNOWN'

export interface FileOperationRequest {
  oldPath: string
  newPath: string
}

export interface FileOperationResult {
  path: string
  success: boolean
  error?: string
  code?: DesktopErrorCode
}

export interface DesktopRuntimeInfo {
  platform: string
  runtime: RuntimeKind
  channel: ReleaseChannel
}

export interface AppUpdateInfo {
  available: boolean
  version?: string
}

export type PendingChangesHandler = () => boolean | Promise<boolean>
export type FileDropHandler = (paths: string[]) => void
export type FileDragStateHandler = (isDragging: boolean) => void

export interface DesktopBridge {
  selectFiles(): Promise<string[]>
  selectDirectory(): Promise<string | undefined>
  renameFiles(files: FileOperationRequest[], options?: { failOnExist?: boolean }): Promise<FileOperationResult[]>
  copyRenameFiles(files: FileOperationRequest[]): Promise<FileOperationResult[]>
  openExternal(url: string): Promise<void>
  setZoomFactor(factor: number): Promise<void> | void
  getRuntimeInfo(): Promise<DesktopRuntimeInfo>
  setPendingChangesHandler(handler: PendingChangesHandler): Promise<void> | void
  clearPendingChangesHandler(): Promise<void> | void
  onFilesDropped?(handler: FileDropHandler): Promise<() => void>
  onFileDragStateChanged?(handler: FileDragStateHandler): Promise<() => void>
  checkForAppUpdate?(): Promise<AppUpdateInfo | null>
  installAppUpdate?(): Promise<void>
}
