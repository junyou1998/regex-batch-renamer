import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { desktop } from '../services/desktop'
import type { AiCliStatus, AiChatMessage, AiPipelineItem } from '../services/desktop/types'
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
}

export const useAiStore = defineStore('ai', () => {
  const isOpen = ref(false)
  const isCheckingStatus = ref(false)
  const status = ref<AiCliStatus | null>(null)
  const messages = ref<AiMessageItem[]>([])
  const isLoading = ref(false)
  const autoApply = ref(true)

  const operationStore = useOperationStore()
  const fileStore = useFileStore()
  const settingsStore = useSettingsStore()
  const toastStore = useToastStore()

  async function checkStatus() {
    if (!desktop.checkAiCliStatus) {
      status.value = {
        installed: false,
        ready: false,
        message: 'Desktop bridge unavailable',
      }
      return
    }

    isCheckingStatus.value = true
    try {
      status.value = await desktop.checkAiCliStatus()
    } catch (e: any) {
      status.value = {
        installed: false,
        ready: false,
        message: e?.message || String(e),
      }
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

    if (!status.value?.ready) {
      await checkStatus()
      if (!status.value?.ready) {
        toastStore.addToast(status.value?.message || 'Claude Code CLI 未就緒', 'error')
        return
      }
    }

    const userMessage: AiMessageItem = {
      id: uuidv4(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
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
      })

      const assistantMessage: AiMessageItem = {
        id: uuidv4(),
        role: 'assistant',
        content: response.reply,
        explanation: response.explanation,
        pipeline: response.pipeline,
        timestamp: Date.now(),
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
      })
      toastStore.addToast(`AI 生成失敗: ${errorMsg}`, 'error')
    } finally {
      isLoading.value = false
    }
  }

  return {
    isOpen,
    isCheckingStatus,
    status,
    messages,
    isLoading,
    autoApply,
    checkStatus,
    toggleOpen,
    openDrawer,
    closeDrawer,
    clearHistory,
    applyPipeline,
    sendMessage,
  }
})
