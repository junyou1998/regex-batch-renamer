<template>
  <!-- Gemini -->
  <span v-if="provider === 'gemini'" :class="wrapperClass">
    <GeminiIcon :class="iconClass || 'w-4 h-4 text-purple-600 dark:text-purple-400'" />
  </span>

  <!-- Claude / Claude CLI -->
  <span v-else-if="provider === 'claude' || provider === 'claude_cli'" :class="wrapperClass">
    <ClaudeIcon :class="iconClass || 'w-4 h-4 text-[#D97757]'" />
  </span>

  <!-- OpenAI / Codex CLI -->
  <span v-else-if="provider === 'openai' || provider === 'codex_cli'" :class="wrapperClass">
    <CodexIcon :class="iconClass || 'w-4 h-4 text-slate-800 dark:text-slate-200'" />
  </span>

  <!-- xAI Grok CLI -->
  <span v-else-if="provider === 'grok_cli'" :class="wrapperClass">
    <GrokIcon :class="iconClass || 'w-4 h-4 text-slate-800 dark:text-slate-200'" />
  </span>

  <!-- DeepSeek -->
  <span v-else-if="provider === 'deepseek'" :class="wrapperClass">
    <svg :class="iconClass || 'w-4 h-4 text-blue-500'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  </span>

  <!-- Qwen -->
  <span v-else-if="provider === 'qwen'" :class="wrapperClass">
    <svg :class="iconClass || 'w-4 h-4 text-amber-500'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="14" x="3" y="5" rx="4" />
      <path d="M9 12h6" />
    </svg>
  </span>

  <!-- MiniMax -->
  <span v-else-if="provider === 'minimax'" :class="wrapperClass">
    <svg :class="iconClass || 'w-4 h-4 text-pink-500'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 10v4" />
      <path d="M6 6v12" />
      <path d="M10 3v18" />
      <path d="M14 8v8" />
      <path d="M18 5v14" />
      <path d="M22 10v4" />
    </svg>
  </span>

  <!-- Ollama -->
  <span v-else-if="provider === 'ollama'" :class="wrapperClass">
    <svg :class="iconClass || 'w-4 h-4 text-slate-700 dark:text-slate-300'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 4v4" />
      <path d="M8 8a4 4 0 0 0 8 0" />
      <circle cx="9" cy="14" r="1" fill="currentColor" />
      <circle cx="15" cy="14" r="1" fill="currentColor" />
      <path d="M10 18h4" />
      <rect x="5" y="8" width="14" height="12" rx="4" />
    </svg>
  </span>

  <!-- Custom / Fallback -->
  <span v-else :class="wrapperClass">
    <SlidersHorizontal :class="iconClass || 'w-4 h-4 text-slate-600 dark:text-slate-400'" />
  </span>
</template>

<script setup lang="ts">
import ClaudeIcon from './ClaudeIcon.vue'
import CodexIcon from './CodexIcon.vue'
import GrokIcon from './GrokIcon.vue'
import GeminiIcon from './GeminiIcon.vue'
import { SlidersHorizontal } from 'lucide-vue-next'
import type { AiProviderKind } from '../../services/desktop/types'

defineProps<{
  provider: AiProviderKind | string
  wrapperClass?: string
  iconClass?: string
}>()
</script>
