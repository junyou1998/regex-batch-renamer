import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { desktop } from '../services/desktop'
import type {
  AiCliStatus,
  AiChatMessage,
  AiChatResponse,
  AiPipelineItem,
  AiProviderType,
  AiProfile,
  AiApiTestResult,
  AiUsage,
} from '../services/desktop/types'
import { useOperationStore, type OperationType } from './operationStore'
import { useFileStore } from './fileStore'
import { useSettingsStore } from './settingsStore'
import { useToastStore } from './toastStore'
import { usePluginStore } from './pluginStore'
import { compileRuleRegex } from '../services/renameEngine'
import { describeAiError } from '../utils/aiErrors'
import i18n from '../i18n'

const t = (key: string, params?: Record<string, unknown>) => i18n.global.t(key, params ?? {}) as string

export interface AiMessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  explanation?: string
  pipeline?: AiPipelineItem[]
  /** Pipeline before this suggestion was applied, for one-click revert. */
  previousPipeline?: AiPipelineItem[]
  applied?: boolean
  /** Steps the app dropped because they were invalid. */
  rejectedSteps?: number
  usage?: AiUsage
  model?: string
  timestamp: number
  isError?: boolean
  isCancelled?: boolean
  provider?: AiProviderType | string
}

export const DEFAULT_API_MODELS: Record<string, string> = {
  anthropic: 'claude-opus-5-5',
  openai: 'gpt-5.5',
  // Google's alias for its current Flash model, so the default never goes stale.
  gemini: 'gemini-flash-latest',
  ollama: 'llama3.3',
}

const DEFAULT_PROFILES: AiProfile[] = [
  { id: 'claude-cli', name: 'Claude Code CLI', provider: 'claude_cli', type: 'cli', isBuiltin: true },
  { id: 'codex-cli', name: 'Codex CLI', provider: 'codex_cli', type: 'cli', isBuiltin: true },
  { id: 'grok-cli', name: 'Grok CLI', provider: 'grok_cli', type: 'cli', isBuiltin: true },
  {
    id: 'gemini-default',
    name: 'Gemini',
    provider: 'gemini',
    type: 'api',
    endpoint: 'https://generativelanguage.googleapis.com',
    model: DEFAULT_API_MODELS.gemini,
    isBuiltin: false,
  },
]

const PROFILES_KEY = 'ai_profiles_list_v2'
const ACTIVE_KEY = 'ai_active_profile_id'
const AUTO_APPLY_KEY = 'ai_auto_apply_v2'
const PRIVACY_ACK_KEY = 'ai_privacy_ack_v1'

/** Model IDs that were never valid or have been retired, mapped to a current default. */
const STALE_MODEL_IDS: Record<string, string> = {
  'claude-4-6-sonnet': DEFAULT_API_MODELS.anthropic,
  'claude-3-7-sonnet-latest': DEFAULT_API_MODELS.anthropic,
  'gemini-1.5-flash': DEFAULT_API_MODELS.gemini,
  'gpt-4.5-preview': DEFAULT_API_MODELS.openai,
}

const ALLOWED_STEP_TYPES: OperationType[] = ['regex', 'plugin']

// One-time fix for a default that a pre-release build wrote but that Google's
// API doesn't offer. Runs once, so a real future model of that name is left alone.
const ONE_TIME_MODEL_FIXES_KEY = 'ai_model_fixes_v1'
const ONE_TIME_MODEL_FIXES: Record<string, string> = {
  'gemini-3.8-flash': 'gemini-flash-latest',
}

function loadSavedProfiles(): AiProfile[] {
  try {
    const saved = localStorage.getItem(PROFILES_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const applyOneTime = localStorage.getItem(ONE_TIME_MODEL_FIXES_KEY) !== 'done'
        localStorage.setItem(ONE_TIME_MODEL_FIXES_KEY, 'done')
        return parsed.map((p: AiProfile) => {
          let model = p.model && STALE_MODEL_IDS[p.model] ? STALE_MODEL_IDS[p.model] : p.model
          if (applyOneTime && model && ONE_TIME_MODEL_FIXES[model]) model = ONE_TIME_MODEL_FIXES[model]
          return { ...p, model }
        })
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved AI profiles', e)
  }
  return DEFAULT_PROFILES.map(p => ({ ...p }))
}

function cliKeyOf(profile: AiProfile): AiProviderType {
  if (profile.provider === 'codex_cli') return 'codex'
  if (profile.provider === 'grok_cli') return 'grok'
  return 'claude'
}

/** Strip anything secret before writing profiles to localStorage. */
function persistable(profile: AiProfile): AiProfile {
  const { apiKey: _apiKey, ...rest } = profile
  return rest
}

export const useAiStore = defineStore('ai', () => {
  const isOpen = ref(false)
  const isCheckingStatus = ref(false)

  const profiles = ref<AiProfile[]>(loadSavedProfiles())
  const activeProfileId = ref<string>(localStorage.getItem(ACTIVE_KEY) || '')

  const activeProfile = computed<AiProfile>(() => {
    return profiles.value.find((p) => p.id === activeProfileId.value) || profiles.value[0]
  })

  const selectedProvider = computed<AiProviderType>(() => {
    return activeProfile.value.type === 'cli' ? cliKeyOf(activeProfile.value) : 'gemini_api'
  })

  const claudeStatus = ref<AiCliStatus | null>(null)
  const codexStatus = ref<AiCliStatus | null>(null)
  const grokStatus = ref<AiCliStatus | null>(null)

  const isTestingApi = ref(false)
  const apiTestResult = ref<AiApiTestResult | null>(null)

  const status = computed<AiCliStatus | null>(() => {
    const prof = activeProfile.value
    if (prof.type === 'api') {
      const isOllama = prof.provider === 'ollama'
      const isReady = isOllama || Boolean(prof.hasSavedKey)
      return {
        installed: true,
        ready: isReady,
        version: prof.model || DEFAULT_API_MODELS[prof.provider] || '',
        provider: prof.provider,
        message: isReady ? undefined : t('ai.errors.AI_MISSING_API_KEY'),
      }
    }
    if (prof.provider === 'codex_cli') return codexStatus.value
    if (prof.provider === 'grok_cli') return grokStatus.value
    return claudeStatus.value
  })

  const messages = ref<AiMessageItem[]>([])
  const isLoading = ref(false)
  // Default to preview-then-apply: suggestions no longer silently replace rules.
  const autoApply = ref(localStorage.getItem(AUTO_APPLY_KEY) === 'true')
  const privacyAcknowledged = ref(localStorage.getItem(PRIVACY_ACK_KEY) === 'true')
  const currentTaskId = ref<string | null>(null)
  const currentRunningProfile = ref<AiProfile | null>(null)

  const operationStore = useOperationStore()
  const fileStore = useFileStore()
  const settingsStore = useSettingsStore()
  const toastStore = useToastStore()

  function persistProfiles() {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles.value.map(persistable)))
    localStorage.setItem(ACTIVE_KEY, activeProfileId.value)
  }

  function setAutoApply(value: boolean) {
    autoApply.value = value
    localStorage.setItem(AUTO_APPLY_KEY, String(value))
  }

  function acknowledgePrivacy() {
    privacyAcknowledged.value = true
    localStorage.setItem(PRIVACY_ACK_KEY, 'true')
  }

  /**
   * One-time migration: move API keys that older versions kept in localStorage
   * into the Rust-side secret store, then mark which profiles have a key.
   */
  async function initSecrets() {
    let raw: AiProfile[] = []
    try {
      raw = JSON.parse(localStorage.getItem(PROFILES_KEY) || '[]')
    } catch {
      raw = []
    }
    const legacyKeys = raw.filter(p => p?.id && typeof p.apiKey === 'string' && p.apiKey.trim())
    for (const legacy of legacyKeys) {
      try {
        await desktop.setAiSecret?.(legacy.id, legacy.apiKey!.trim())
      } catch (e) {
        console.error('Failed to migrate API key for profile', legacy.id, e)
        return // keep the legacy copy so nothing is lost; retry next launch
      }
    }
    const savedIds = new Set((await desktop.listAiSecretIds?.()) ?? [])
    profiles.value = profiles.value.map(p => ({ ...p, apiKey: undefined, hasSavedKey: savedIds.has(p.id) }))
    persistProfiles()
  }

  /** Pick the first ready provider when nothing was chosen yet. */
  async function initDefaultProfile() {
    if (activeProfileId.value && profiles.value.some(p => p.id === activeProfileId.value)) {
      const prof = activeProfile.value
      if (prof.type === 'cli') void checkStatus(cliKeyOf(prof))
      return
    }
    await checkAllStatuses()
    const readyCli = profiles.value.find(p => {
      if (p.type !== 'cli') return false
      const s = cliKeyOf(p) === 'codex' ? codexStatus.value : cliKeyOf(p) === 'grok' ? grokStatus.value : claudeStatus.value
      return s?.ready
    })
    const readyApi = profiles.value.find(p => p.type === 'api' && (p.hasSavedKey || p.provider === 'ollama'))
    activeProfileId.value = (readyCli || readyApi || profiles.value[0]).id
    persistProfiles()
  }

  async function init() {
    await initSecrets()
    await initDefaultProfile()
  }

  function setActiveProfile(id: string) {
    const target = profiles.value.find((p) => p.id === id)
    if (!target) return
    activeProfileId.value = id
    persistProfiles()
    if (target.type === 'cli') void checkStatus(cliKeyOf(target))
  }

  /** Save a profile. A typed key goes to the secret store, never localStorage. */
  async function saveProfile(profile: AiProfile) {
    const typedKey = profile.apiKey?.trim()
    let hasSavedKey = Boolean(profiles.value.find(p => p.id === profile.id)?.hasSavedKey)
    if (profile.type === 'api' && typedKey) {
      await desktop.setAiSecret?.(profile.id, typedKey)
      hasSavedKey = true
    }
    const stored: AiProfile = { ...profile, apiKey: undefined, hasSavedKey }
    const index = profiles.value.findIndex((p) => p.id === profile.id)
    if (index >= 0) profiles.value[index] = stored
    else profiles.value.push(stored)
    activeProfileId.value = profile.id
    persistProfiles()
  }

  async function clearSavedKey(profileId: string) {
    await desktop.deleteAiSecret?.(profileId)
    profiles.value = profiles.value.map(p => (p.id === profileId ? { ...p, hasSavedKey: false } : p))
    persistProfiles()
  }

  async function deleteProfile(id: string) {
    const target = profiles.value.find((p) => p.id === id)
    if (!target || target.isBuiltin) return
    profiles.value = profiles.value.filter((p) => p.id !== id)
    if (activeProfileId.value === id) {
      activeProfileId.value = profiles.value[0]?.id || 'claude-cli'
    }
    persistProfiles()
    try {
      await desktop.deleteAiSecret?.(id)
    } catch (e) {
      console.warn('Failed to delete saved key', e)
    }
  }

  async function testProfileConnection(profile: AiProfile): Promise<AiApiTestResult> {
    isTestingApi.value = true
    apiTestResult.value = null
    try {
      const res = desktop.testAiApiConnection
        ? await desktop.testAiApiConnection(profile)
        : { success: false, message: 'Desktop bridge unavailable' }
      apiTestResult.value = res
      return res
    } catch (e: any) {
      const res = { success: false, message: e?.message || String(e) }
      apiTestResult.value = res
      return res
    } finally {
      isTestingApi.value = false
    }
  }

  async function listModels(profile: AiProfile): Promise<string[]> {
    return (await desktop.listAiModels?.(profile)) ?? []
  }

  async function checkStatus(prov?: AiProviderType) {
    const targetProvider = prov || selectedProvider.value
    if (targetProvider === 'gemini_api') return

    const assign = (value: AiCliStatus) => {
      if (targetProvider === 'codex') codexStatus.value = value
      else if (targetProvider === 'grok') grokStatus.value = value
      else claudeStatus.value = value
    }

    if (!desktop.checkAiCliStatus) {
      assign({ installed: false, ready: false, message: 'Desktop bridge unavailable', provider: targetProvider })
      return
    }

    isCheckingStatus.value = true
    try {
      assign(await desktop.checkAiCliStatus(targetProvider))
    } catch (e: any) {
      assign({ installed: false, ready: false, message: e?.message || String(e), provider: targetProvider })
    } finally {
      isCheckingStatus.value = false
    }
  }

  async function checkAllStatuses() {
    isCheckingStatus.value = true
    try {
      await Promise.all([checkStatus('claude'), checkStatus('codex'), checkStatus('grok')])
    } finally {
      isCheckingStatus.value = false
    }
  }

  function toggleOpen() {
    isOpen.value = !isOpen.value
    if (isOpen.value && !status.value) void checkStatus()
  }

  function openDrawer() {
    isOpen.value = true
    if (!status.value) void checkStatus()
  }

  function closeDrawer() {
    isOpen.value = false
  }

  function clearHistory() {
    messages.value = []
  }

  /** Drop steps the app can't run (unknown type, missing plugin, bad regex). */
  function validatePipeline(pipeline: AiPipelineItem[]): { valid: AiPipelineItem[]; rejected: number } {
    const pluginStore = usePluginStore()
    const valid: AiPipelineItem[] = []
    for (const step of pipeline || []) {
      if (!step || !ALLOWED_STEP_TYPES.includes(step.type as OperationType) || typeof step.params !== 'object' || !step.params) continue
      if (step.type === 'plugin') {
        const plugin = pluginStore.getPlugin(String(step.params.pluginId || ''))
        if (!plugin || !plugin.enabled) continue
      } else {
        const params = {
          pattern: String(step.params.pattern ?? ''),
          replacement: String(step.params.replacement ?? ''),
          useRegex: step.params.useRegex !== false,
          caseInsensitive: Boolean(step.params.caseInsensitive),
        }
        if (!params.pattern) continue
        if (compileRuleRegex({ id: '', type: 'regex', enabled: true, params }).error) continue
        valid.push({ type: 'regex', params })
        continue
      }
      valid.push({ type: step.type, params: { ...step.params } })
    }
    return { valid, rejected: (pipeline?.length || 0) - valid.length }
  }

  function samePipeline(a: AiPipelineItem[], b: AiPipelineItem[]) {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  function applyMessagePipeline(messageId: string) {
    const msg = messages.value.find(m => m.id === messageId)
    if (!msg?.pipeline || msg.pipeline.length === 0) return
    msg.previousPipeline = operationStore.getSnapshot()
    operationStore.loadFromPreset(msg.pipeline)
    msg.applied = true
  }

  function revertMessagePipeline(messageId: string) {
    const msg = messages.value.find(m => m.id === messageId)
    if (!msg?.previousPipeline) return
    operationStore.loadFromPreset(msg.previousPipeline)
    msg.applied = false
    toastStore.addToast(t('ai.reverted'), 'info', 2500)
  }

  /** Kept for callers that apply an arbitrary pipeline (e.g. presets). */
  function applyPipeline(pipeline: AiPipelineItem[]) {
    if (!pipeline || pipeline.length === 0) return
    operationStore.loadFromPreset(pipeline)
  }

  function installedPluginSummaries() {
    const pluginStore = usePluginStore()
    return pluginStore.enabledTransformerPlugins.map(p => ({
      id: p.manifest.id,
      name: p.manifest.name,
      description: p.manifest.description,
      options: (p.manifest.options || []).map(o => ({
        key: o.key,
        type: o.type,
        default: o.default,
        choices: o.options?.map(c => c.value),
        description: o.description,
      })),
    }))
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading.value) return

    const prof = activeProfile.value

    if (prof.type === 'api') {
      if (prof.provider !== 'ollama' && !prof.hasSavedKey) {
        toastStore.addToast(t('ai.errors.AI_MISSING_API_KEY'), 'error')
        return
      }
    } else if (!status.value?.ready) {
      await checkStatus(cliKeyOf(prof))
      if (!status.value?.ready) {
        toastStore.addToast(describeAiError(status.value?.message || '') || t('ai.notReady', { name: prof.name }), 'error')
        return
      }
    }

    // History is everything *before* this prompt; the prompt itself is sent separately.
    const historyPayload: AiChatMessage[] = messages.value
      .filter((m) => !m.isError && !m.isCancelled)
      .slice(-8)
      .map((m) => ({
        role: m.role,
        content: m.pipeline?.length ? `${m.content}\n[pipeline] ${JSON.stringify(m.pipeline)}` : m.content,
      }))

    messages.value.push({ id: uuidv4(), role: 'user', content: trimmed, timestamp: Date.now(), provider: prof.provider })

    const taskId = uuidv4()
    currentTaskId.value = taskId
    currentRunningProfile.value = { ...prof }
    isLoading.value = true

    try {
      const samples = fileStore.files.slice(0, 30)
      const chatRequest = {
        prompt: trimmed,
        history: historyPayload,
        sampleFilenames: samples.map((f) => f.originalName),
        currentPipeline: operationStore.getSnapshot(),
        currentPreview: samples
          .filter(f => f.newName !== f.originalName)
          .slice(0, 15)
          .map(f => ({ before: f.originalName, after: f.newName })),
        installedPlugins: installedPluginSummaries(),
        processFilenameOnly: settingsStore.processFilenameOnly,
        provider: prof.provider,
        model: prof.type === 'cli' ? prof.model?.trim() || undefined : undefined,
        taskId,
      }

      let response: AiChatResponse
      if (prof.type === 'api') {
        if (!desktop.runAiApiChat) throw new Error('AI API bridge unavailable')
        response = await desktop.runAiApiChat(chatRequest, prof)
      } else {
        if (!desktop.runAiChat) throw new Error('AI CLI bridge unavailable')
        response = await desktop.runAiChat({ ...chatRequest, provider: cliKeyOf(prof) })
      }

      if (currentTaskId.value !== taskId) return

      const { valid, rejected } = validatePipeline(response.pipeline || [])
      const changesPipeline = valid.length > 0 && !samePipeline(valid, operationStore.getSnapshot())
      const assistantMessage: AiMessageItem = {
        id: uuidv4(),
        role: 'assistant',
        content: response.reply,
        explanation: response.explanation,
        pipeline: changesPipeline ? valid : undefined,
        rejectedSteps: rejected > 0 ? rejected : undefined,
        usage: response.usage,
        model: response.model,
        timestamp: Date.now(),
        provider: prof.provider,
      }
      messages.value.push(assistantMessage)

      if (autoApply.value && changesPipeline) {
        applyMessagePipeline(assistantMessage.id)
      }
    } catch (error: any) {
      const raw = error?.message || String(error)
      if (raw.includes('AI_TASK_CANCELLED') || currentTaskId.value !== taskId) return
      console.error('Failed to send AI chat message:', error)
      const friendly = describeAiError(raw)
      messages.value.push({
        id: uuidv4(),
        role: 'assistant',
        content: friendly,
        timestamp: Date.now(),
        isError: true,
        provider: prof.provider,
      })
    } finally {
      if (currentTaskId.value === taskId) {
        currentTaskId.value = null
        currentRunningProfile.value = null
        isLoading.value = false
      }
    }
  }

  async function stopGeneration() {
    if (!isLoading.value) return
    const taskId = currentTaskId.value
    const runningProf = currentRunningProfile.value

    isLoading.value = false
    currentTaskId.value = null
    currentRunningProfile.value = null

    if (taskId && desktop.cancelAiChat) {
      try {
        await desktop.cancelAiChat(taskId)
      } catch (err) {
        console.warn('Failed to cancel AI task:', err)
      }
    }

    messages.value.push({
      id: uuidv4(),
      role: 'assistant',
      content: t('ai.stopped'),
      timestamp: Date.now(),
      isCancelled: true,
      provider: runningProf?.provider,
    })
  }

  return {
    isOpen,
    isCheckingStatus,
    profiles,
    activeProfileId,
    activeProfile,
    currentTaskId,
    currentRunningProfile,
    selectedProvider,
    claudeStatus,
    codexStatus,
    grokStatus,
    isTestingApi,
    apiTestResult,
    status,
    messages,
    isLoading,
    autoApply,
    privacyAcknowledged,
    init,
    setAutoApply,
    acknowledgePrivacy,
    setActiveProfile,
    saveProfile,
    clearSavedKey,
    deleteProfile,
    testProfileConnection,
    listModels,
    checkStatus,
    checkAllStatuses,
    toggleOpen,
    openDrawer,
    closeDrawer,
    clearHistory,
    applyPipeline,
    applyMessagePipeline,
    revertMessagePipeline,
    sendMessage,
    stopGeneration,
  }
})
