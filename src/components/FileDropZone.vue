<script setup lang="ts">
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useFileStore } from '../stores/fileStore'

const fileStore = useFileStore()
const isDragging = ref(false)

function onDrop(e: DragEvent) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files) {
    const fileList = Array.from(files).map(file => ({
      id: uuidv4(),
      originalName: file.name,
      path: file.path, // Electron exposes path
      newName: file.name,
      status: 'pending' as const
    }))
    fileStore.addFiles(fileList)
  }
}

function onDragOver() {
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

async function openFileDialog() {
  const paths = await window.ipcRenderer.selectFiles()
  if (paths && paths.length > 0) {
    // We need to get the filename from the path since we don't have the File object directly from dialog
    // Actually, for consistency, let's assume the main process returns paths and we parse them.
    // But wait, the previous implementation returned paths.
    // Let's parse the filename from the path in JS.
    const fileList = paths.map(path => {
      const name = path.split(/[/\\]/).pop() || path
      return {
        id: uuidv4(),
        originalName: name,
        path: path,
        newName: name,
        status: 'pending' as const
      }
    })
    fileStore.addFiles(fileList)
  }
}
</script>

<template>
  <div @drop.prevent="onDrop" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave" @click="openFileDialog"
    class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer group"
    :class="[
      isDragging
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
