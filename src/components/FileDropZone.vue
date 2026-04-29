<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFileStore } from '../stores/fileStore'
import { useToastStore } from '../stores/toastStore'
import { desktop } from '../services/desktop'

const fileStore = useFileStore()
const toastStore = useToastStore()
const { t } = useI18n()
const isDragging = ref(false)

defineProps<{
  isFileDragActive?: boolean
}>()

function addFiles(paths: string[]) {
  fileStore.addFilePaths(paths)
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files) {
    const paths = Array.from(files)
      .map(file => file.path)
      .filter((path): path is string => Boolean(path))

    addFiles(paths)
  }
}

function onDragOver() {
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

async function openFileDialog() {
  try {
    const paths = await desktop.selectFiles()
    addFiles(paths)
  } catch (error) {
    console.error('Failed to select files:', error)
    toastStore.addToast(t('dropZone.openFailed'), 'error')
  }
}
</script>

<template>
  <div @drop.prevent="onDrop" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @click="openFileDialog"
    class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer group"
    :class="[
      isDragging || isFileDragActive
        ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
        : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-200/30 dark:hover:bg-slate-700/30 bg-slate-100/50 dark:bg-slate-800/50'
    ]">
    <div
      class="text-4xl mb-2 text-slate-400 dark:text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
      📂
    </div>
    <p
      class="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
      {{ $t('dropZone.text') }} <span
        class="text-blue-600 dark:text-blue-400 underline decoration-blue-400/30 group-hover:decoration-blue-500 dark:group-hover:decoration-blue-400">{{
          $t('dropZone.action') }}</span>
    </p>
    <p class="text-xs text-slate-500 dark:text-slate-500 mt-1">{{ $t('dropZone.supports') }}</p>
  </div>
</template>
