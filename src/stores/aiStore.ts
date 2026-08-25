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
} from '../services/desktop/types'
import { useOperationStore } from './operationStore'
import { useFileStore } from './fileStore'
import { useSettingsStore } from './settingsStore'
import { useToastStore } from './toastStore'

export interface AiMessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  explanation?: string
  pipeline?: AiPipelineItem[]
  timestamp: number
  isError?: boolean
  provider?: AiProviderType | string
}

const DEFAULT_PROFILES: AiProfile[] = [
  {
    id: 'claude-cli',
    name: 'claude code cli',
    provider: 'claude_cli',
    type: 'cli',
    isBuiltin: true,
  },
  {
    id: 'codex-cli',
    name: 'codex cli',
    provider: 'codex_cli',
    type: 'cli',
    isBuiltin: true,
  },
  {
    id: 'grok-cli',
    name: 'grok cli',
    provider: 'grok_cli',
    type: 'cli',
    isBuiltin: true,
  },
  {
    id: 'gemini-default',
    name: 'gemini',
    provider: 'gemini',
    type: 'api',
    apiKey: '',
    endpoint: 'https://generativelanguage.googleapis.com',
    model: 'gemini-3.6-flash',
    temperature: 0.2,
    isBuiltin: false,
  },
]

function loadSavedProfiles(): AiProfile[] {
  try {
    const saved = localStorage.getItem('ai_profiles_list_v2')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.warn('Failed to parse saved AI profiles', e)
  }
  return DEFAULT_PROFILES
}

export const useAiStore = defineStore('ai', () => {
  const isOpen = ref(false)
  const isCheckingStatus = ref(false)

  const profiles = ref<AiProfile[]>(loadSavedProfiles())
  const activeProfileId = ref<string>(
    localStorage.getItem('ai_active_profile_id') || 'gemini-default'
  )

  const activeProfile = computed<AiProfile>(() => {
    return profiles.value.find((p) => p.id === activeProfileId.value) || profiles.value[0]
  })

  // Selected provider compatibility
  const selectedProvider = computed<AiProviderType>(() => {
    if (activeProfile.value.provider === 'codex_cli') return 'codex'
    if (activeProfile.value.provider === 'grok_cli') return 'grok'
    if (activeProfile.value.provider === 'claude_cli') return 'claude'
    return 'gemini_api'
  })

  const claudeStatus = ref<AiCliStatus | null>(null)
  const codexStatus = ref<AiCliStatus | null>(null)
  const grokStatus = ref<AiCliStatus | null>(null)

  const isTestingApi = ref(false)
  const apiTestResult = ref<AiApiTestResult | null>(null)

  const status = computed<AiCliStatus | null>(() => {
    const prof = activeProfile.value
    if (prof.type === 'api') {
      const hasKey = !!prof.apiKey?.trim()
      return {
        installed: true,
        ready: hasKey,
        version: prof.model || 'gemini-3.6-flash',
        provider: prof.provider,
        message: hasKey ? undefined : '尚未設定 API Key',
      }
    }
    if (prof.provider === 'codex_cli') return codexStatus.value
    if (prof.provider === 'grok_cli') return grokStatus.value
    return claudeStatus.value
  })

  const messages = ref<AiMessageItem[]>([])
  const isLoading = ref(false)
  const autoApply = ref(true)
  const currentTaskId = ref<string | null>(null)
  const currentRunningProfile = ref<AiProfile | null>(null)

  const operationStore = useOperationStore()
  const fileStore = useFileStore()
  const settingsStore = useSettingsStore()
  const toastStore = useToastStore()

  function persistProfiles() {
    localStorage.setItem('ai_profiles_list_v2', JSON.stringify(profiles.value))
    localStorage.setItem('ai_active_profile_id', activeProfileId.value)
  }

  function setActiveProfile(id: string) {
    const target = profiles.value.find((p) => p.id === id)
    if (target) {
      activeProfileId.value = id
      persistProfiles()
      if (target.type === 'cli') {
        const cliKey = target.provider === 'codex_cli' ? 'codex' : target.provider === 'grok_cli' ? 'grok' : 'claude'
        void checkStatus(cliKey)
      }
    }
  }

  function saveProfile(profile: AiProfile) {
    const index = profiles.value.findIndex((p) => p.id === profile.id)
    if (index >= 0) {
      profiles.value[index] = { ...profile }
    } else {
      profiles.value.push({ ...profile })
    }
    activeProfileId.value = profile.id
    persistProfiles()
  }

  function deleteProfile(id: string) {
    const target = profiles.value.find((p) => p.id === id)
    if (!target || target.isBuiltin) return

    profiles.value = profiles.value.filter((p) => p.id !== id)
    if (activeProfileId.value === id) {
      activeProfileId.value = profiles.value[0]?.id || 'claude-cli'
    }
    persistProfiles()
  }

  async function testProfileConnection(profile: AiProfile): Promise<AiApiTestResult> {
    if (!desktop.testAiApiConnection) {
      const res = { success: false, message: '桌面環境不支援 API 測試' }
      apiTestResult.value = res
      return res
    }

    isTestingApi.value = true
    apiTestResult.value = null
    try {
      const res = await desktop.testAiApiConnection(profile)
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

  async function checkStatus(prov?: AiProviderType) {
    const targetProvider = prov || selectedProvider.value
    if (targetProvider === 'gemini_api') return

    if (!desktop.checkAiCliStatus) {
      const fallback: AiCliStatus = {
        installed: false,
        ready: false,
        message: 'Desktop bridge unavailable',
        provider: targetProvider,
      }
      if (targetProvider === 'codex') codexStatus.value = fallback
      else if (targetProvider === 'grok') grokStatus.value = fallback
      else claudeStatus.value = fallback
      return
    }

    isCheckingStatus.value = true
    try {
      const res = await desktop.checkAiCliStatus(targetProvider)
      if (targetProvider === 'codex') {
        codexStatus.value = res
      } else if (targetProvider === 'grok') {
        grokStatus.value = res
      } else {
        claudeStatus.value = res
      }
    } catch (e: any) {
      const fallback: AiCliStatus = {
        installed: false,
        ready: false,
        message: e?.message || String(e),
        provider: targetProvider,
      }
      if (targetProvider === 'codex') {
        codexStatus.value = fallback
      } else if (targetProvider === 'grok') {
        grokStatus.value = fallback
      } else {
        claudeStatus.value = fallback
      }
    } finally {
      isCheckingStatus.value = false
    }
  }

  async function checkAllStatuses() {
    isCheckingStatus.value = true
    try {
      await Promise.all([
        checkStatus('claude'),
        checkStatus('codex'),
        checkStatus('grok'),
      ])
    } finally {
      isCheckingStatus.value = false
    }
  }

  function toggleOpen() {
    isOpen.value = !isOpen.value
    if (isOpen.value && !status.value) {
      void checkStatus()
    }
  }

  function openDrawer() {
    isOpen.value = true
    if (!status.value) {
      void checkStatus()
    }
  }

  function closeDrawer() {
    isOpen.value = false
  }

  function clearHistory() {
    messages.value = []
  }

  function applyPipeline(pipeline: AiPipelineItem[]) {
    if (!pipeline || pipeline.length === 0) return
    operationStore.loadFromPreset(pipeline)
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading.value) return

    const prof = activeProfile.value

    if (prof.type === 'api') {
      if (!prof.apiKey?.trim()) {
        toastStore.addToast(`請先至設定填寫 ${prof.name || 'API'} 的 API Key`, 'error')
        return
      }
    } else {
      if (!status.value?.ready) {
        const cliKey = prof.provider === 'codex_cli' ? 'codex' : prof.provider === 'grok_cli' ? 'grok' : 'claude'
        await checkStatus(cliKey)
        if (!status.value?.ready) {
          toastStore.addToast(status.value?.message || `${prof.name} 未就緒`, 'error')
          return
        }
      }
    }

    const userMessage: AiMessageItem = {
      id: uuidv4(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      provider: prof.provider,
    }
    messages.value.push(userMessage)

    const taskId = uuidv4()
    currentTaskId.value = taskId
    currentRunningProfile.value = { ...prof }
    isLoading.value = true

    try {
      // Prepare context
      const historyPayload: AiChatMessage[] = messages.value
        .filter((m) => !m.isError)
        .slice(-8)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))

      const sampleFilenames = fileStore.files.slice(0, 20).map((f) => f.originalName)
      const currentPipeline = operationStore.getSnapshot()

      const chatRequest = {
        prompt: trimmed,
        history: historyPayload,
        sampleFilenames,
        currentPipeline,
        processFilenameOnly: settingsStore.processFilenameOnly,
        provider: prof.provider,
        taskId,
      }

      let response: AiChatResponse
      if (prof.type === 'api') {
        if (!desktop.runAiApiChat) {
          throw new Error('AI API Chat bridge is unavailable in this environment')
        }
        response = await desktop.runAiApiChat(chatRequest, prof)
      } else {
        if (!desktop.runAiChat) {
          throw new Error('AI Chat bridge is unavailable in this environment')
        }
        const cliTarget = prof.provider === 'codex_cli' ? 'codex' : prof.provider === 'grok_cli' ? 'grok' : 'claude'
        response = await desktop.runAiChat({ ...chatRequest, provider: cliTarget })
      }

      // If task was cancelled during wait, drop response
      if (currentTaskId.value !== taskId) {
        return
      }

      const assistantMessage: AiMessageItem = {
        id: uuidv4(),
        role: 'assistant',
        content: response.reply,
        explanation: response.explanation,
        pipeline: response.pipeline,
        timestamp: Date.now(),
        provider: prof.provider,
      }

      messages.value.push(assistantMessage)

      if (autoApply.value && response.pipeline && response.pipeline.length > 0) {
        applyPipeline(response.pipeline)
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error)
      if (errorMsg.includes('AI_TASK_CANCELLED') || currentTaskId.value !== taskId) {
        console.log('AI task was cancelled')
        return
      }
      console.error('Failed to send AI chat message:', error)
      messages.value.push({
        id: uuidv4(),
        role: 'assistant',
        content: `執行發生錯誤: ${errorMsg}`,
        timestamp: Date.now(),
        isError: true,
        provider: prof.provider,
      })
      toastStore.addToast(`AI 生成失敗: ${errorMsg}`, 'error')
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
      content: '⚠️ 已中止生成。',
      timestamp: Date.now(),
      isError: true,
      provider: runningProf?.provider,
    })
    toastStore.addToast('已中止 AI 生成', 'info')
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
    setActiveProfile,
    saveProfile,
    deleteProfile,
    testProfileConnection,
    checkStatus,
    checkAllStatuses,
    toggleOpen,
    openDrawer,
    closeDrawer,
    clearHistory,
    applyPipeline,
    sendMessage,
    stopGeneration,
  }
})
