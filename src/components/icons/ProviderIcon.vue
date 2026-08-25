<template>
  <span :class="['inline-flex items-center justify-center shrink-0 overflow-hidden', $attrs.class as string, wrapperClass]">
    <!-- Gemini API -->
    <GeminiIcon v-if="provider === 'gemini'" :class="iconClass || 'w-full h-full text-purple-600 dark:text-purple-400'" />

    <!-- Anthropic API (Uses official Anthropic mark) -->
    <AnthropicIcon v-else-if="provider === 'anthropic'" :class="iconClass || 'w-full h-full text-slate-800 dark:text-slate-200'" />

    <!-- OpenAI API (Uses official ChatGPT rosette knot logo) -->
    <OpenAiIcon v-else-if="provider === 'openai'" :class="iconClass || 'w-full h-full text-slate-800 dark:text-slate-200'" />

    <!-- Claude Code CLI (Uses Claude sunburst icon) -->
    <ClaudeIcon v-else-if="provider === 'claude_cli' || provider === 'claude'" :class="iconClass || 'w-full h-full text-[#D97757]'" />

    <!-- OpenAI Codex CLI (Uses Codex terminal icon) -->
    <CodexIcon v-else-if="provider === 'codex_cli'" :class="iconClass || 'w-full h-full text-slate-800 dark:text-slate-200'" />

    <!-- xAI Grok CLI (Uses Grok slash icon) -->
    <GrokIcon v-else-if="provider === 'grok_cli'" :class="iconClass || 'w-full h-full text-slate-800 dark:text-slate-200'" />

    <!-- Ollama -->
    <OllamaIcon v-else-if="provider === 'ollama'" :class="iconClass || 'w-full h-full text-slate-800 dark:text-slate-200'" />

    <!-- Custom / Fallback -->
    <SlidersHorizontal v-else :class="iconClass || 'w-full h-full text-slate-600 dark:text-slate-400'" />
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
