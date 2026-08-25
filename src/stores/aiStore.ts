import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { desktop } from '../services/desktop'
import type { AiCliStatus, AiChatMessage, AiPipelineItem, AiProviderType } from '../services/desktop/types'
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

export const useAiStore = defineStore('ai', () => {
  const isOpen = ref(false)
  const isCheckingStatus = ref(false)
  const selectedProvider = ref<AiProviderType>(
    (localStorage.getItem('ai_provider') as AiProviderType) || 'claude'
  )

  const claudeStatus = ref<AiCliStatus | null>(null)
  const codexStatus = ref<AiCliStatus | null>(null)
  const grokStatus = ref<AiCliStatus | null>(null)

  const status = computed(() => {
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
    if (!status.value) {
      void checkStatus(prov)
    }
  }

  async function checkStatus(prov?: AiProviderType) {
    const targetProvider = prov || selectedProvider.value
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
      if (!desktop.runAiChat) {
        throw new Error('AI Chat bridge is unavailable in this environment')
      }

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

      const response = await desktop.runAiChat({
        prompt: trimmed,
        history: historyPayload,
        sampleFilenames,
        currentPipeline,
        processFilenameOnly: settingsStore.processFilenameOnly,
        provider: currentProvider,
      })

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
    status,
    messages,
    isLoading,
    autoApply,
    setProvider,
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
