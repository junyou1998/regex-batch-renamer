export type ReleaseChannel = 'stable' | 'beta'
export type RuntimeKind = 'tauri'

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
  | 'gemini'
  | 'claude'
  | 'openai'
  | 'deepseek'
  | 'qwen'
  | 'minimax'
  | 'ollama'
  | 'custom'

export interface AiProfile {
  id: string
  name: string
  provider: AiProviderKind
  type: 'cli' | 'api'
  apiKey?: string
  endpoint?: string
  model?: string
  temperature?: number
  isBuiltin?: boolean
}

export type AiApiProfile = AiProfile

export interface AiApiTestResult {
  success: boolean
  message: string
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

export interface AiChatRequest {
  prompt: string
  history: AiChatMessage[]
  sampleFilenames: string[]
  currentPipeline: AiRuleSnapshot[]
  processFilenameOnly?: boolean
  provider?: AiProviderType | string
}

export interface AiPipelineItem {
  type: string
  params: Record<string, any>
}

export interface AiChatResponse {
  reply: string
  explanation?: string
  pipeline: AiPipelineItem[]
}

export interface DesktopBridge {
  selectFiles(): Promise<string[]>
  selectDirectory(): Promise<string | undefined>
  renameFiles(files: FileOperationRequest[], options?: { failOnExist?: boolean }): Promise<FileOperationResult[]>
  copyRenameFiles(files: FileOperationRequest[]): Promise<FileOperationResult[]>
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
  runAiApiChat?(request: AiChatRequest, profile: AiApiProfile): Promise<AiChatResponse>
}
