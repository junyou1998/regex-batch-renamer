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
  AiApiProfile,
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
  provider?: AiProviderType
}

const DEFAULT_GEMINI_PROFILE: AiApiProfile = {
  id: 'gemini-default',
  name: 'Gemini 2.5 Flash',
  provider: 'gemini',
  apiKey: '',
  endpoint: 'https://generativelanguage.googleapis.com',
  model: 'gemini-2.5-flash',
  temperature: 0.2,
}

function loadSavedGeminiProfile(): AiApiProfile {
  try {
    const saved = localStorage.getItem('ai_gemini_profile')
    if (saved) {
      return { ...DEFAULT_GEMINI_PROFILE, ...JSON.parse(saved) }
    }
  } catch (e) {
    console.warn('Failed to parse saved gemini profile', e)
  }
  return { ...DEFAULT_GEMINI_PROFILE }
}

export const useAiStore = defineStore('ai', () => {
  const isOpen = ref(false)
  const isCheckingStatus = ref(false)
  const selectedProvider = ref<AiProviderType>(
    (localStorage.getItem('ai_provider') as AiProviderType) || 'claude'
  )

  const claudeStatus = ref<AiCliStatus | null>(null)
  const codexStatus = ref<AiCliStatus | null>(null)
  const grokStatus = ref<AiCliStatus | null>(null)

  const geminiProfile = ref<AiApiProfile>(loadSavedGeminiProfile())
  const isTestingApi = ref(false)
  const apiTestResult = ref<AiApiTestResult | null>(null)

  const status = computed<AiCliStatus | null>(() => {
    if (selectedProvider.value === 'gemini_api') {
      const hasKey = !!geminiProfile.value.apiKey.trim()
      return {
        installed: true,
        ready: hasKey,
        version: geminiProfile.value.model || 'gemini-2.5-flash',
        provider: 'gemini_api',
        message: hasKey ? undefined : '尚未設定 Gemini API Key',
      }
    }
    if (selectedProvider.value === 'codex') return codexStatus.value
    if (selectedProvider.value === 'grok') return grokStatus.value
    return claudeStatus.value
  })

  const messages = ref<AiMessageItem[]>([])
  const isLoading = ref(false)
  const autoApply = ref(true)

  const operationStore = useOperationStore()
  const fileStore = useFileStore()
  const settingsStore = useSettingsStore()
  const toastStore = useToastStore()

  function setProvider(prov: AiProviderType) {
    selectedProvider.value = prov
    localStorage.setItem('ai_provider', prov)
    if (prov !== 'gemini_api' && !status.value) {
      void checkStatus(prov)
    }
  }

  function saveGeminiProfile(partial: Partial<AiApiProfile>) {
    geminiProfile.value = { ...geminiProfile.value, ...partial }
    localStorage.setItem('ai_gemini_profile', JSON.stringify(geminiProfile.value))
  }

  async function testGeminiConnection(customProfile?: AiApiProfile): Promise<AiApiTestResult> {
    const prof = customProfile || geminiProfile.value
    if (!desktop.testAiApiConnection) {
      const res = { success: false, message: '桌面環境不支援 API 測試' }
      apiTestResult.value = res
      return res
    }

    isTestingApi.value = true
    apiTestResult.value = null
    try {
      const res = await desktop.testAiApiConnection(prof)
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

    const currentProvider = selectedProvider.value

    if (currentProvider === 'gemini_api') {
      if (!geminiProfile.value.apiKey.trim()) {
        toastStore.addToast('請先至設定填寫 Google Gemini API Key', 'error')
        return
      }
    } else {
      if (!status.value?.ready) {
        await checkStatus(currentProvider)
        if (!status.value?.ready) {
          const provName =
            currentProvider === 'codex'
              ? 'OpenAI Codex CLI'
              : currentProvider === 'grok'
                ? 'xAI Grok CLI'
                : 'Claude Code CLI'
          toastStore.addToast(status.value?.message || `${provName} 未就緒`, 'error')
          return
        }
      }
    }

    const userMessage: AiMessageItem = {
      id: uuidv4(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      provider: currentProvider,
    }
    messages.value.push(userMessage)

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
        provider: currentProvider,
      }

      let response: AiChatResponse
      if (currentProvider === 'gemini_api') {
        if (!desktop.runAiApiChat) {
          throw new Error('AI API Chat bridge is unavailable in this environment')
        }
        response = await desktop.runAiApiChat(chatRequest, geminiProfile.value)
      } else {
        if (!desktop.runAiChat) {
          throw new Error('AI Chat bridge is unavailable in this environment')
        }
        response = await desktop.runAiChat(chatRequest)
      }

      const assistantMessage: AiMessageItem = {
        id: uuidv4(),
        role: 'assistant',
        content: response.reply,
        explanation: response.explanation,
        pipeline: response.pipeline,
        timestamp: Date.now(),
        provider: currentProvider,
      }

      messages.value.push(assistantMessage)

      if (autoApply.value && response.pipeline && response.pipeline.length > 0) {
        applyPipeline(response.pipeline)
      }
    } catch (error: any) {
      console.error('Failed to send AI chat message:', error)
      const errorMsg = error?.message || String(error)
      messages.value.push({
        id: uuidv4(),
        role: 'assistant',
        content: `執行發生錯誤: ${errorMsg}`,
        timestamp: Date.now(),
        isError: true,
        provider: currentProvider,
      })
      toastStore.addToast(`AI 生成失敗: ${errorMsg}`, 'error')
    } finally {
      isLoading.value = false
    }
  }

  return {
    isOpen,
    isCheckingStatus,
    selectedProvider,
    claudeStatus,
    codexStatus,
    grokStatus,
    geminiProfile,
    isTestingApi,
    apiTestResult,
    status,
    messages,
    isLoading,
    autoApply,
    setProvider,
    saveGeminiProfile,
    testGeminiConnection,
    checkStatus,
    checkAllStatuses,
    toggleOpen,
    openDrawer,
    closeDrawer,
    clearHistory,
    applyPipeline,
    sendMessage,
  }
})
