<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  FolderOpen,
  LoaderCircle,
  RefreshCw,
  Send,
  Sparkles,
  Terminal,
  Trash2,
  Undo2,
  X,
  Zap,
} from 'lucide-vue-next'
import { useAiStore, type AiMessageItem } from '../stores/aiStore'
import { useFileStore } from '../stores/fileStore'
import { useToastStore } from '../stores/toastStore'
import ClaudeIcon from './icons/ClaudeIcon.vue'
import CodexIcon from './icons/CodexIcon.vue'

const { t } = useI18n()
const aiStore = useAiStore()
const fileStore = useFileStore()
const toastStore = useToastStore()

const inputText = ref('')
const isComposing = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const inputTextarea = ref<HTMLTextAreaElement | null>(null)
const copiedCommand = ref<string | null>(null)

const quickPrompts = computed(() => [
  t('ai.quickPromptAnalyze'),
  t('ai.quickPromptExtractDate'),
  t('ai.quickPromptRemoveSpaces'),
  t('ai.quickPromptAddSequence'),
])

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(
  () => aiStore.messages.length,
  () => {
    scrollToBottom()
  }
)

watch(
  () => aiStore.isLoading,
  () => {
    scrollToBottom()
  }
)

watch(
  () => aiStore.isOpen,
  (open) => {
    if (open) {
      nextTick(() => {
        inputTextarea.value?.focus()
        scrollToBottom()
      })
    }
  }
)

onMounted(() => {
  if (aiStore.isOpen) {
    void aiStore.checkStatus()
  }
})

function adjustTextareaHeight() {
  nextTick(() => {
    const el = inputTextarea.value
    if (!el) return
    el.style.height = 'auto'
    const targetHeight = Math.min(Math.max(el.scrollHeight, 38), 180)
    el.style.height = `${targetHeight}px`
  })
}

watch(inputText, () => {
  adjustTextareaHeight()
})

function handleSend() {
  const text = inputText.value.trim()
  if (!text || aiStore.isLoading) return
  inputText.value = ''
  adjustTextareaHeight()
  void aiStore.sendMessage(text)
}

function handleCompositionStart() {
  isComposing.value = true
}

function handleCompositionEnd() {
  isComposing.value = false
}

function handleKeydown(e: KeyboardEvent) {
  // Protect against IME candidate selection (Bopomofo / Pinyin / Japanese)
  if (e.isComposing || isComposing.value || e.keyCode === 229) {
    return
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function selectQuickPrompt(promptText: string) {
  inputText.value = promptText
  adjustTextareaHeight()
  handleSend()
}

function handleChipsWheel(e: WheelEvent) {
  const container = e.currentTarget as HTMLElement
  if (container) {
    container.scrollLeft += e.deltaY
  }
}

async function copyToClipboard(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedCommand.value = key
    toastStore.addToast(t('common.copied'), 'success', 2000)
    setTimeout(() => {
      if (copiedCommand.value === key) {
        copiedCommand.value = null
      }
    }, 2500)
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
  }
}

function renderMarkdown(content: string): string {
  try {
    return marked.parse(content, { breaks: true, gfm: true }) as string
  } catch {
    return content
  }
}

function handleApplyPipeline(msg: AiMessageItem) {
  if (msg.pipeline) {
    aiStore.applyPipeline(msg.pipeline)
    toastStore.addToast(t('ai.pipelineApplied'), 'success', 2500)
  }
}
</script>

<template>
  <div class="flex flex-col flex-1 min-w-96 h-full min-h-0 overflow-hidden bg-slate-50/90 dark:bg-slate-900/90 select-text">
    <!-- Header Section (Clean 2-tier layout) -->
    <div class="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shrink-0 select-none">
      <!-- Tier 1: Main Title & Close / Clear -->
      <div class="h-11 px-4 flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0">
          <div
            class="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0"
          >
            <Sparkles class="w-3.5 h-3.5" />
          </div>
          <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
            {{ $t('ai.title') }}
          </h2>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <button
            v-if="aiStore.messages.length > 0"
            @click="aiStore.clearHistory"
            class="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="$t('ai.clearChat')"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>

          <button
            @click="aiStore.closeDrawer"
            class="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            :title="$t('ai.closePanel')"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Tier 2: Status Pill + Auto-apply Toggle -->
      <div class="px-4 pb-2.5 pt-0.5 flex items-center justify-between gap-2">
        <!-- Status Pill -->
        <div
          class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 text-[11px] min-w-0"
        >
          <CodexIcon v-if="aiStore.selectedProvider === 'codex'" className="w-3.5 h-3.5 shrink-0" />
          <ClaudeIcon v-else className="w-3 h-3 text-[#D97757] shrink-0" />
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="{
              'bg-emerald-500 animate-pulse': aiStore.status?.ready,
              'bg-amber-500': aiStore.isCheckingStatus,
              'bg-red-500': !aiStore.status?.ready && !aiStore.isCheckingStatus,
            }"
          ></span>
          <span class="text-slate-600 dark:text-slate-300 font-medium truncate">
            <template v-if="aiStore.isCheckingStatus">
              {{ $t('ai.statusChecking') }}
            </template>
            <template v-else-if="aiStore.status?.ready">
              {{ aiStore.selectedProvider === 'codex' ? 'Codex' : 'Claude Code' }}
              <span class="text-slate-400 font-normal">({{ aiStore.status.version || 'Ready' }})</span>
            </template>
            <template v-else>
              {{ $t('ai.statusNotReady') }}
            </template>
          </span>
          <button
            type="button"
            @click="aiStore.checkStatus()"
            :disabled="aiStore.isCheckingStatus"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-sm transition-colors cursor-pointer shrink-0 ml-0.5"
            :title="$t('ai.refreshStatus')"
          >
            <RefreshCw
              class="w-3 h-3"
              :class="{ 'animate-spin': aiStore.isCheckingStatus }"
            />
          </button>
        </div>

        <!-- Auto Apply Checkbox -->
        <label
          class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none shrink-0"
          :title="$t('ai.autoApplyDesc')"
        >
          <input
            type="checkbox"
            v-model="aiStore.autoApply"
            class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
          />
          <span class="text-[11px] font-medium">{{ $t('ai.autoApply') }}</span>
        </label>
      </div>
    </div>

    <!-- Body Area -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 min-h-0"
    >
      <!-- Case 1: CLI Not Ready Notice -->
      <div
        v-if="!aiStore.status?.ready && !aiStore.isCheckingStatus"
        class="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-3"
      >
        <div class="flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
          <AlertTriangle class="w-5 h-5 shrink-0 mt-0.5" />
          <div class="space-y-1 text-xs">
            <p class="font-semibold text-sm">
              {{ aiStore.selectedProvider === 'codex' ? $t('ai.onboardingCodexTitle') : $t('ai.onboardingTitle') }}
            </p>
            <p class="text-amber-700 dark:text-amber-400/90 leading-relaxed">
              {{ aiStore.selectedProvider === 'codex' ? $t('ai.onboardingCodexDesc') : $t('ai.onboardingDesc') }}
            </p>
          </div>
        </div>

        <!-- Steps with copy buttons -->
        <div class="space-y-2 pt-1 text-xs">
          <div class="space-y-1">
            <span class="font-medium text-slate-700 dark:text-slate-300">
              1. {{ aiStore.selectedProvider === 'codex' ? $t('ai.stepInstallCodexCli') : $t('ai.stepInstallCli') }}
            </span>
            <div
              class="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px]"
            >
              <span class="truncate">
                {{ aiStore.selectedProvider === 'codex' ? 'npm i -g @openai/codex' : 'npm i -g @anthropic-ai/claude-code' }}
              </span>
              <button
                @click="copyToClipboard(aiStore.selectedProvider === 'codex' ? 'npm i -g @openai/codex' : 'npm i -g @anthropic-ai/claude-code', 'install')"
                class="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Check v-if="copiedCommand === 'install'" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div class="space-y-1">
            <span class="font-medium text-slate-700 dark:text-slate-300">
              2. {{ aiStore.selectedProvider === 'codex' ? $t('ai.stepLoginCodexCli') : $t('ai.stepLoginCli') }}
            </span>
            <div
              class="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px]"
            >
              <span class="truncate">
                {{ aiStore.selectedProvider === 'codex' ? 'codex login' : 'claude login' }}
              </span>
              <button
                @click="copyToClipboard(aiStore.selectedProvider === 'codex' ? 'codex login' : 'claude login', 'login')"
                class="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Check v-if="copiedCommand === 'login'" class="w-3.5 h-3.5 text-emerald-400" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="aiStore.checkStatus()"
          class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': aiStore.isCheckingStatus }" />
          {{ $t('ai.recheck') }}
        </button>
      </div>

      <!-- Empty State / Welcome Hero -->
      <div
        v-if="aiStore.messages.length === 0"
        class="py-6 flex flex-col items-center text-center space-y-4"
      >
        <div
          class="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
        >
          <Bot class="w-6 h-6" />
        </div>

        <div class="space-y-1 max-w-xs">
          <h3 class="font-bold text-base text-slate-800 dark:text-slate-100">
            {{ $t('ai.welcomeTitle') }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {{ $t('ai.welcomeSubtitle') }}
          </p>
        </div>

        <!-- Workspace Context Info -->
        <div
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-700 dark:text-blue-300 font-medium"
        >
          <FolderOpen class="w-3.5 h-3.5" />
          <span>{{ $t('ai.workspaceContext', { n: fileStore.files.length }) }}</span>
        </div>

        <!-- Quick Suggestions -->
        <div class="w-full space-y-2 pt-2 text-left">
          <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block ml-1">
            {{ $t('ai.suggestedPrompts') }}
          </span>
          <div class="grid grid-cols-1 gap-2">
            <button
              v-for="(prompt, idx) in quickPrompts"
              :key="idx"
              @click="selectQuickPrompt(prompt)"
              class="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 text-xs text-slate-700 dark:text-slate-300 transition-all text-left flex items-center justify-between group cursor-pointer shadow-2xs"
            >
              <span class="truncate">{{ prompt }}</span>
              <Zap class="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
            </button>
          </div>
        </div>
      </div>

      <!-- Message List -->
      <template v-else>
        <div
          v-for="msg in aiStore.messages"
          :key="msg.id"
          class="space-y-2"
          :class="{ 'flex flex-col items-end': msg.role === 'user' }"
        >
          <!-- User Bubble -->
          <div
            v-if="msg.role === 'user'"
            class="max-w-[85%] rounded-2xl rounded-tr-xs bg-blue-600 text-white px-3.5 py-2.5 text-sm shadow-xs leading-relaxed whitespace-pre-wrap break-words"
          >
            {{ msg.content }}
          </div>

          <!-- Assistant Bubble -->
          <div v-else class="space-y-2.5 w-full">
            <div
              class="rounded-2xl rounded-tl-xs bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-3.5 shadow-2xs space-y-2.5"
              :class="{ '!border-red-300 dark:!border-red-800 !bg-red-50/50 dark:!bg-red-950/20': msg.isError }"
            >
              <!-- Markdown Content -->
              <div
                class="text-xs sm:text-sm text-slate-800 dark:text-slate-200 prose dark:prose-invert prose-xs max-w-none leading-relaxed break-words"
                v-html="renderMarkdown(msg.content)"
              ></div>

              <!-- Technical Explanation -->
              <div
                v-if="msg.explanation"
                class="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1"
              >
                <span class="font-semibold text-blue-600 dark:text-blue-400 block">
                  💡 {{ $t('ai.technicalDetails') }}
                </span>
                <p class="leading-relaxed">{{ msg.explanation }}</p>
              </div>

              <!-- Generated Rule Pipeline Snapshot Card -->
              <div
                v-if="msg.pipeline && msg.pipeline.length > 0"
                class="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/40 dark:bg-blue-950/30 p-3 space-y-2"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Terminal class="w-3.5 h-3.5" />
                    {{ $t('ai.pipelineCardTitle', { n: msg.pipeline.length }) }}
                  </span>
                  <button
                    @click="handleApplyPipeline(msg)"
                    class="px-2 py-1 rounded-md text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Undo2 class="w-3 h-3" />
                    {{ $t('ai.applyThisPipeline') }}
                  </button>
                </div>

                <!-- Steps Preview -->
                <div class="space-y-1.5">
                  <div
                    v-for="(step, sIdx) in msg.pipeline"
                    :key="sIdx"
                    class="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-blue-900/50 font-mono text-[11px] space-y-0.5"
                  >
                    <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
                      <span>#{{ sIdx + 1 }} {{ step.type }}</span>
                      <span v-if="step.params?.useRegex" class="text-blue-600 dark:text-blue-400 font-bold">Regex</span>
                    </div>
                    <div class="text-slate-800 dark:text-slate-200 truncate">
                      <span class="text-red-500 dark:text-red-400">/{{ step.params?.pattern }}/</span>
                      <span class="mx-1 text-slate-400">→</span>
                      <span class="text-emerald-600 dark:text-emerald-400">"{{ step.params?.replacement }}"</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading Indicator Bubble -->
        <div v-if="aiStore.isLoading" class="flex items-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 w-fit">
          <LoaderCircle class="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
          <span class="text-xs text-slate-500 dark:text-slate-400 animate-pulse">
            {{ aiStore.selectedProvider === 'codex' ? $t('ai.codexThinking') : $t('ai.thinking') }}
          </span>
        </div>
      </template>
    </div>

    <!-- Quick chips bar above input (No ugly scrollbar, smooth wheel scroll) -->
    <div
      v-if="aiStore.messages.length > 0"
      @wheel.passive="handleChipsWheel"
      class="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 select-none"
    >
      <button
        v-for="(prompt, idx) in quickPrompts"
        :key="idx"
        @click="selectQuickPrompt(prompt)"
        class="px-2.5 py-1 rounded-full text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap transition-colors cursor-pointer shadow-2xs shrink-0"
      >
        {{ prompt }}
      </button>
    </div>

    <!-- Input Area -->
    <div
      class="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0"
    >
      <div
        class="relative rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all p-2 flex flex-col gap-2 shadow-inner"
      >
        <textarea
          ref="inputTextarea"
          v-model="inputText"
          rows="1"
          @input="adjustTextareaHeight"
          @compositionstart="handleCompositionStart"
          @compositionend="handleCompositionEnd"
          @keydown="handleKeydown"
          :placeholder="$t('ai.inputPlaceholder')"
          class="w-full bg-transparent resize-none text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none custom-scrollbar min-h-[38px] max-h-[180px] leading-relaxed transition-[height] duration-75"
        ></textarea>

        <div class="flex items-center justify-between">
          <span class="text-[10px] text-slate-400 dark:text-slate-500 select-none">
            {{ $t('ai.enterToSend') }}
          </span>

          <button
            @click="handleSend"
            :disabled="!inputText.trim() || aiStore.isLoading"
            class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
          >
            <LoaderCircle v-if="aiStore.isLoading" class="w-3.5 h-3.5 animate-spin" />
            <Send v-else class="w-3.5 h-3.5" />
            <span>{{ $t('ai.send') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
