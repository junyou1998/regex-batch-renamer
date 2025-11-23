<script setup lang="ts">
import { ref, watch } from 'vue'
import FileDropZone from './components/FileDropZone.vue'
import OperationPipeline from './components/OperationPipeline.vue'
import FilePreviewList from './components/FilePreviewList.vue'
import ThemeSwitcher from './components/ThemeSwitcher.vue'
import ToastNotification from './components/ToastNotification.vue'
import AboutModal from './components/AboutModal.vue'
import { useFileStore } from './stores/fileStore'
import { useOperationStore } from './stores/operationStore'

const fileStore = useFileStore()
const operationStore = useOperationStore()
const isProcessing = ref(false)
const isSidebarCollapsed = ref(false)
const isMac = window.ipcRenderer?.platform === 'darwin'
const showAbout = ref(false)

// Debounce helper
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// Core Renaming Logic
const updatePreviews = debounce(() => {
  console.log('Running updatePreviews', fileStore.files.length, operationStore.operations)
  if (fileStore.files.length === 0) return

  // Create a snapshot of operations to avoid reactivity issues during loop
  const ops = operationStore.operations.filter(op => op.enabled)

  // Process each file
  // We can optimize this by only processing visible files if the list is huge, 
  // but for now let's process all since we need the full list for numbering potentially.
  // Actually, numbering is usually per-file index based on the current sort order.

  fileStore.files.forEach((file, index) => {
    let currentName = file.originalName

    ops.forEach(op => {
      if (op.type === 'regex') {
        const { pattern, replacement } = op.params
        if (pattern) {
          try {
            let regex: RegExp
            if (op.params.useRegex === false) {
              // Escape special regex characters for plain text matching
              const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              regex = new RegExp(escapedPattern, 'g')
            } else {
              regex = new RegExp(pattern, 'g') // Global replace by default
            }

            // Handle ${n} syntax
            // We need to replace ${n} or ${n:03} with the actual number
            // This needs to happen FOR EACH match if we want sequential numbering per match?
            // Or usually it's per file?
            // The user requirement: "流水號我原本是希望用在替換時 用類似＄等文字作為遞增數字的語法"
            // Usually in batch renamers, ${n} refers to the file's index in the list.

            const fileIndex = index + 1

            // Function to replace the numbering syntax in the replacement string
            const processReplacementString = (repStr: string) => {
              return repStr.replace(/\$\{n(?::(\d+))?\}/g, (_match, width) => {
                const padding = width ? parseInt(width, 10) : 0
                return fileIndex.toString().padStart(padding, '0')
              })
            }

            const finalReplacement = processReplacementString(replacement || '')

            currentName = currentName.replace(regex, finalReplacement)
          } catch (e) {
            // Invalid regex, ignore
          }
        }
      }
    })

    // Only update if changed to avoid unnecessary reactivity triggers
    if (file.newName !== currentName) {
      fileStore.updateNewName(file.id, currentName)
    }
  })
}, 300) // 300ms debounce

// Watch for changes in files and operations
watch(
  [() => fileStore.files, () => operationStore.operations],
  () => {
    console.log('Triggering updatePreviews due to change')
    updatePreviews()
  },
  { deep: true }
)

// Actions
async function handleRename() {
  if (isProcessing.value) return
  isProcessing.value = true

  const filesToRename = fileStore.files.map(f => ({
    oldPath: f.path,
    newPath: f.path.replace(f.originalName, f.newName) // Construct new full path
    // Note: This assumes the file stays in the same directory.
    // If we want to support moving, we need to handle directory changes.
    // For now, simple rename in place.
  }))

  const results = await window.ipcRenderer.renameFiles(filesToRename)

  results.forEach(res => {
    const file = fileStore.files.find(f => f.path === res.path)
    if (file) {
      if (res.success) {
        // Update file state to reflect the rename
        const newPath = file.path.replace(file.originalName, file.newName)
        fileStore.updateFileAfterRename(file.id, newPath, file.newName)
      } else {
        fileStore.updateFileStatus(file.id, 'error', res.error)
      }
    }
  })

  isProcessing.value = false
}

async function handleCopyTo() {
  if (isProcessing.value) return

  const targetDir = await window.ipcRenderer.selectDirectory()
  if (!targetDir) return

  isProcessing.value = true

  // For Copy To, we need to construct the new path in the target directory
  // We need to know the path separator (win32 vs posix). 
  // Since we are in renderer, we can't use path module directly easily without polyfill.
  // But we can assume '/' for now or handle both.
  // Actually, we can send the targetDir and filenames to main process and let it handle joining.
  // But our IPC expects full paths.
  // Let's do a simple join.
  const separator = targetDir.includes('\\') ? '\\' : '/'

  const filesToCopy = fileStore.files.map(f => ({
    oldPath: f.path,
    newPath: `${targetDir}${separator}${f.newName}`
  }))

  const results = await window.ipcRenderer.copyRenameFiles(filesToCopy)

  results.forEach(res => {
    const file = fileStore.files.find(f => f.path === res.path)
    if (file) {
      if (res.success) {
        // For Copy To, we mark as success but don't update the file state
        // since the original file remains unchanged
        fileStore.updateFileStatus(file.id, 'success')
      } else {
        fileStore.updateFileStatus(file.id, 'error', res.error)
      }
    }
  })

  isProcessing.value = false
}
</script>

<template>
  <div
    class="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 font-sans selection:bg-blue-200 dark:selection:bg-blue-500/30 selection:text-blue-900 dark:selection:text-blue-200 transition-colors">
    <!-- Draggable Title Bar (macOS only) -->
    <div v-if="isMac" class="drag-region fixed top-0 left-0 right-0 h-12 z-50"></div>

    <!-- Sidebar -->
    <aside :class="[
      'flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-xl transition-all duration-300 overflow-hidden',
      isSidebarCollapsed ? 'w-16' : 'w-80'
    ]">
      <!-- Collapsed state: only show toggle button -->
      <div v-if="isSidebarCollapsed" class="flex-1 flex items-center justify-center pt-14">
        <button @click="isSidebarCollapsed = false" title="顯示左側面板"
          class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Expanded state: show full content -->
      <div v-else class="flex flex-col flex-1 min-w-80 h-full">
        <div
          class="p-6 pt-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div class="flex-1">
            <h1
              class="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 bg-clip-text text-transparent">
              Regex Batch Renamer
            </h1>
            <p class="text-xs text-slate-500 dark:text-slate-500 mt-1">批次更名工具</p>
          </div>
          <div class="flex items-center gap-1">
            <button @click="showAbout = true" title="關於本專案"
              class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <ThemeSwitcher />
            <button @click="isSidebarCollapsed = true" title="隱藏左側面板"
              class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar min-h-0">
          <FileDropZone />
          <OperationPipeline />
        </div>

        <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80">
          <div class="grid grid-cols-2 gap-3">
            <button @click="handleRename" :disabled="isProcessing || fileStore.files.length === 0"
              class="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
              {{ isProcessing ? '處理中...' : '執行重命名' }}
            </button>
            <button @click="handleCopyTo" :disabled="isProcessing || fileStore.files.length === 0"
              class="px-4 py-2.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
              {{ isProcessing ? '處理中...' : '複製到...' }}
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col bg-white dark:bg-slate-950">
      <div class="flex-1 p-6 overflow-hidden">
        <FilePreviewList />
      </div>
    </main>
    <ToastNotification />
    <AboutModal v-model="showAbout" />
  </div>
</template>

<style>
/* Draggable title bar */
.drag-region {
  -webkit-app-region: drag;
}

/* Global scrollbar styling */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(71, 85, 105, 0.5);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.8);
}
</style>
