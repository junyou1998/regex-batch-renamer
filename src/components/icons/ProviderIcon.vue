<template>
  <!-- Gemini API -->
  <span v-if="provider === 'gemini'" :class="wrapperClass">
    <GeminiIcon :class="iconClass || 'w-4 h-4 text-purple-600 dark:text-purple-400'" />
  </span>

  <!-- Anthropic API (Uses official Anthropic mark) -->
  <span v-else-if="provider === 'anthropic'" :class="wrapperClass">
    <AnthropicIcon :class="iconClass || 'w-4 h-4 text-slate-800 dark:text-slate-200'" />
  </span>

  <!-- OpenAI API (Uses official ChatGPT rosette knot logo) -->
  <span v-else-if="provider === 'openai'" :class="wrapperClass">
    <OpenAiIcon :class="iconClass || 'w-4 h-4 text-slate-800 dark:text-slate-200'" />
  </span>

  <!-- Claude Code CLI (Uses Claude sunburst icon) -->
  <span v-else-if="provider === 'claude_cli' || provider === 'claude'" :class="wrapperClass">
    <ClaudeIcon :class="iconClass || 'w-4 h-4 text-[#D97757]'" />
  </span>

  <!-- OpenAI Codex CLI (Uses Codex terminal icon) -->
  <span v-else-if="provider === 'codex_cli'" :class="wrapperClass">
    <CodexIcon :class="iconClass || 'w-4 h-4 text-slate-800 dark:text-slate-200'" />
  </span>

  <!-- xAI Grok CLI (Uses Grok slash icon) -->
  <span v-else-if="provider === 'grok_cli'" :class="wrapperClass">
    <GrokIcon :class="iconClass || 'w-4 h-4 text-slate-800 dark:text-slate-200'" />
  </span>

  <!-- Ollama -->
  <span v-else-if="provider === 'ollama'" :class="wrapperClass">
    <OllamaIcon :class="iconClass || 'w-4 h-4 text-slate-800 dark:text-slate-200'" />
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
import AnthropicIcon from './AnthropicIcon.vue'
import OpenAiIcon from './OpenAiIcon.vue'
import OllamaIcon from './OllamaIcon.vue'
import { SlidersHorizontal } from 'lucide-vue-next'
import type { AiProviderKind } from '../../services/desktop/types'

defineProps<{
  provider: AiProviderKind | string
  wrapperClass?: string
  iconClass?: string
}>()
</script>
