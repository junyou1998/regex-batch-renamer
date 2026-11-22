<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Copy } from 'lucide-vue-next'
import { copyText } from '../utils/clipboard'
import { useToastStore } from '../stores/toastStore'

/** Inline code snippet that copies itself to the clipboard on click. */
const props = withDefaults(defineProps<{ code: string; tone?: 'pink' | 'green' | 'slate' }>(), { tone: 'pink' })

const { t } = useI18n()
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const toneClass = {
  pink: 'text-pink-600 dark:text-pink-400',
  green: 'text-green-600 dark:text-green-400',
  slate: 'text-slate-700 dark:text-slate-300',
}

async function copy() {
  if (await copyText(props.code)) {
    copied.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 1500)
  } else {
    useToastStore().addToast(t('preview.copyFailed'), 'error', 2500)
  }
}
</script>

<template>
  <button
    type="button"
    @click="copy"
    :aria-pressed="copied"
    :aria-label="t('help.copySnippet', { code })"
    v-tooltip="{
      title: copied ? t('help.copied') : t('help.clickToCopy'),
      status: copied ? code : undefined,
      statusOn: copied,
    }"
    class="group/copy inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-sm cursor-pointer transition-colors bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-blue-950/30"
    :class="toneClass[tone]"
  >
    <span>{{ code }}</span>
    <Check v-if="copied" class="w-3 h-3 text-emerald-500 shrink-0" />
    <Copy v-else class="w-3 h-3 text-slate-400 opacity-0 group-hover/copy:opacity-100 shrink-0 transition-opacity" />
  </button>
</template>
