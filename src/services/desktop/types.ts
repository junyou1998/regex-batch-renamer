export type ReleaseChannel = 'stable' | 'beta'
export type RuntimeKind = 'tauri'

export type DesktopErrorCode =
  | 'FILE_EXISTS'
  | 'DUPLICATE_TARGET'
  | 'PERMISSION_DENIED'
  | 'INVALID_PATH'
  | 'NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'ROLLED_BACK'
  | 'IS_DIRECTORY'
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
  /** Path actually written (may carry a " (1)" suffix for copies). */
  newPath?: string
}

export type CopyConflictPolicy = 'skip' | 'suffix'

export interface NativeFileMetadata {
  size: number
  createdAtMs?: number
  modifiedAtMs?: number
  isFile: boolean
  isDir: boolean
}

export interface HttpProxyResponse {
  status: number
  statusText: string
  body: string
}

export interface DesktopRuntimeInfo {
  platform: string
  runtime: RuntimeKind
  channel: ReleaseChannel
  version: string
  appBundlePath?: string
  appBundleParentWritable?: boolean
}

export interface AppUpdateInfo {
  available: boolean
  version?: string
}

export interface PendingChangesOptions {
  title?: string
  message?: string
  okLabel?: string
  cancelLabel?: string
}

export type PendingChangesHandler = () => boolean | Promise<boolean>
export type FileDropHandler = (paths: string[]) => void
export type FileDragStateHandler = (isDragging: boolean) => void

export type AiProviderType = 'claude' | 'codex' | 'grok' | 'gemini_api'

export type AiProviderKind =
  | 'claude_cli'
  | 'codex_cli'
  | 'grok_cli'
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'ollama'
  | 'claude'
  | 'custom'

export interface AiProfile {
  id: string
  name: string
  provider: AiProviderKind
  type: 'cli' | 'api'
  /**
   * Only held in memory while the user types a new key. Saved keys live in the
   * Rust-side secret store and are never sent back to the webview.
   */
  apiKey?: string
  /** True when a key for this profile is saved in the secret store. */
  hasSavedKey?: boolean
  endpoint?: string
  /** For CLI profiles: optional override; empty = the CLI's own default model. */
  model?: string
  temperature?: number
  isBuiltin?: boolean
}

export type AiApiProfile = AiProfile

export interface AiApiTestResult {
  success: boolean
  message: string
  models?: string[]
}

export interface AiCliStatus {
  installed: boolean
  path?: string
  version?: string
  ready: boolean
  message?: string
  provider?: AiProviderType | string
}

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AiRuleSnapshot {
  type: string
  params: Record<string, any>
}

export interface AiPluginSummary {
  id: string
  name: string
  description?: string
  options?: unknown
}

export interface AiChatRequest {
  prompt: string
  history: AiChatMessage[]
  sampleFilenames: string[]
  currentPipeline: AiRuleSnapshot[]
  processFilenameOnly?: boolean
  provider?: AiProviderType | string
  taskId?: string
  model?: string
  installedPlugins?: AiPluginSummary[]
  currentPreview?: Array<{ before: string; after: string }>
}

export interface AiPipelineItem {
  type: string
  params: Record<string, any>
}

export interface AiUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface AiChatResponse {
  reply: string
  explanation?: string
  pipeline: AiPipelineItem[]
  usage?: AiUsage
  model?: string
}

export interface DesktopBridge {
  selectFiles(): Promise<string[]>
  /** `item`: add the folder itself to the list. `destination`: Copy To target. */
  selectDirectory(purpose: 'item' | 'destination'): Promise<string | undefined>
  /** Pick a folder and return the visible files directly inside it. */
  selectFolderContents(): Promise<string[]>
  renameFiles(files: FileOperationRequest[]): Promise<FileOperationResult[]>
  copyRenameFiles(files: FileOperationRequest[], onConflict?: CopyConflictPolicy): Promise<FileOperationResult[]>
  readFileBinary(path: string, maxBytes?: number): Promise<Uint8Array>
  getFileMetadata(path: string): Promise<NativeFileMetadata>
  pluginHttpRequest(request: { method: 'GET' | 'POST'; url: string; headers?: Record<string, string>; body?: string }): Promise<HttpProxyResponse>
  fetchRemoteText(url: string): Promise<string>
  fetchRemoteBytes(url: string): Promise<Uint8Array>
  confirmDialog(message: string, options?: { title?: string; okLabel?: string; cancelLabel?: string; kind?: 'info' | 'warning' | 'error' }): Promise<boolean>
  openExternal(url: string): Promise<void>
  setZoomFactor(factor: number): Promise<void> | void
  getRuntimeInfo(): Promise<DesktopRuntimeInfo>
  setPendingChangesHandler(handler: PendingChangesHandler, options?: PendingChangesOptions): Promise<void> | void
  clearPendingChangesHandler(): Promise<void> | void
  onFilesDropped?(handler: FileDropHandler): Promise<() => void>
  onFileDragStateChanged?(handler: FileDragStateHandler): Promise<() => void>
  checkForAppUpdate?(): Promise<AppUpdateInfo | null>
  installAppUpdate?(): Promise<void>
  startDragging?(): Promise<void>
  toggleMaximize?(): Promise<void>
  openDevTools?(): Promise<void>
  checkAiCliStatus?(provider?: AiProviderType | string): Promise<AiCliStatus>
  runAiChat?(request: AiChatRequest): Promise<AiChatResponse>
  testAiApiConnection?(profile: AiApiProfile): Promise<AiApiTestResult>
  listAiModels?(profile: AiApiProfile): Promise<string[]>
  runAiApiChat?(request: AiChatRequest, profile: AiApiProfile): Promise<AiChatResponse>
  cancelAiChat?(taskId: string): Promise<boolean>
  setAiSecret?(profileId: string, apiKey: string): Promise<void>
  deleteAiSecret?(profileId: string): Promise<void>
  listAiSecretIds?(): Promise<string[]>
  saveTextFile?(content: string, options?: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }): Promise<string | null>
}
