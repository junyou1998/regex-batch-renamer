<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import FileDropZone from './components/FileDropZone.vue'
import OperationPipeline from './components/OperationPipeline.vue'
import FilePreviewList from './components/FilePreviewList.vue'
import ToastNotification from './components/ToastNotification.vue'
import AboutModal from './components/AboutModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import { useFileStore } from './stores/fileStore'
import { useOperationStore } from './stores/operationStore'
import { useSettingsStore } from './stores/settingsStore'
import { useToastStore } from './stores/toastStore'

// @ts-ignore
import { version as currentVersion } from '../package.json'

const fileStore = useFileStore()
const operationStore = useOperationStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()
const { t } = useI18n()
const isProcessing = ref(false)
const isSidebarCollapsed = ref(false)
const isMac = window.ipcRenderer?.platform === 'darwin'
const showAbout = ref(false)
const showSettings = ref(false)

const dragRegionHeight = computed(() => {
  if (!isMac) return '0px'
  const visualHeight = 32
  const zoomFactor = settingsStore.zoomLevel / 100
  return `${visualHeight / zoomFactor}px`
})

const processFilenameOnly = computed(() => settingsStore.processFilenameOnly)
const hasConflicts = ref(false)

const updateAvailable = ref(false)
const latestVersion = ref('')
const releaseUrl = ref('')

function isNewerVersion(oldVer: string, newVer: string) {
  const oldParts = oldVer.split('.').map(Number)
  const newParts = newVer.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const a = oldParts[i] || 0
    const b = newParts[i] || 0
    if (a < b) return true
    if (a > b) return false
  }
  return false
}

async function checkForUpdates() {
  try {
    const res = await fetch('https://api.github.com/repos/junyou1998/regex-batch-renamer/releases/latest')
    if (res.ok) {
      const data = await res.json()
      const tagName = data.tag_name
      const remoteVersion = tagName.startsWith('v') ? tagName.slice(1) : tagName

      if (isNewerVersion(currentVersion, remoteVersion)) {
        updateAvailable.value = true
        latestVersion.value = tagName
        releaseUrl.value = data.html_url
      }
    }
  } catch (e) {
    console.error('Update check failed:', e)
  }
}

function openReleasePage() {
  if (releaseUrl.value) {
    openExternal(releaseUrl.value)
  }
}

function openExternal(url: string) {
  window.ipcRenderer?.invoke('open-external', url)
}


onMounted(() => {
  checkForUpdates()
  settingsStore.initZoom()
  window.addEventListener('keydown', handleGlobalKeydown)
    ; (window as any).__hasPendingChanges = () => {
      return fileStore.files.some(f => f.originalName !== f.newName)
    }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  delete (window as any).__hasPendingChanges
})

function handleGlobalKeydown(e: KeyboardEvent) {
  // Handle Zoom Shortcuts: Cmd/Ctrl + (+/-)
  if (e.metaKey || e.ctrlKey) {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault()
      settingsStore.setZoomLevel(settingsStore.zoomLevel + 10)
    } else if (e.key === '-') {
      e.preventDefault()
      settingsStore.setZoomLevel(settingsStore.zoomLevel - 10)
    } else if (e.key === '0') {
      e.preventDefault()
      settingsStore.setZoomLevel(100)
    }
  }
}


function debounce(fn: Function, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: any[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

const updatePreviews = debounce(() => {
  console.log('Running updatePreviews', fileStore.files.length, operationStore.operations)
  if (fileStore.files.length === 0) return

  const ops = operationStore.operations.filter(op => op.enabled)

  const generatedNames = new Set<string>()
  let conflictFound = false

  fileStore.files.forEach((file, index) => {
    let currentName = file.originalName
    let extension = ''


    if (processFilenameOnly.value) {
      const lastDotIndex = currentName.lastIndexOf('.')
      if (lastDotIndex > 0) {
        extension = currentName.substring(lastDotIndex)
        currentName = currentName.substring(0, lastDotIndex)
      }
    }

    ops.forEach(op => {
      if (op.type === 'regex') {
        const { pattern, replacement } = op.params
        if (pattern) {
          try {
            let regex: RegExp
            if (op.params.useRegex === false) {
              const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              regex = new RegExp(escapedPattern, 'g')
            } else {
              regex = new RegExp(pattern, 'g')
            }

            const processReplacementString = (repStr: string) => {
              return repStr.replace(/\$\{n(?::(\d+)(?::(\d+))?)?\}/g, (_match, width, start) => {
                const padding = width ? parseInt(width, 10) : 0
                const startNum = start !== undefined ? parseInt(start, 10) : 1
                const currentNum = index + startNum
                return currentNum.toString().padStart(padding, '0')
              })
            }

            const finalReplacement = processReplacementString(replacement || '')

            currentName = currentName.replace(regex, finalReplacement)
          } catch (e) {
          }
        }
      }
    })


    if (processFilenameOnly.value && extension) {
      currentName += extension
    }


    if (generatedNames.has(currentName)) {
      conflictFound = true
      fileStore.updateFileStatus(file.id, 'error', 'Filename conflict detected')
    } else {
      generatedNames.add(currentName)
      if (file.status === 'error' && file.errorMessage === 'Filename conflict detected') {
        fileStore.updateFileStatus(file.id, 'idle')
      }
    }

    if (file.newName !== currentName) {
      fileStore.updateNewName(file.id, currentName)
    }
  })

  hasConflicts.value = conflictFound
}, 300)

watch(
  [() => fileStore.files, () => operationStore.operations, processFilenameOnly],
  () => {
    console.log('Triggering updatePreviews due to change')
    updatePreviews()
  },
  { deep: true }
)

async function handleRename() {
  if (isProcessing.value) return
  isProcessing.value = true

  const filesToRename = fileStore.files.map(f => ({
    oldPath: f.path,
    newPath: f.path.replace(f.originalName, f.newName)
  }))

  const results = await window.ipcRenderer.renameFiles(filesToRename, { failOnExist: true })
  const successfulRenames: { id: string; oldPath: string; newPath: string; originalName: string; newName: string }[] = []

  let conflictCount = 0
  results.forEach(res => {
    const file = fileStore.files.find(f => f.path === res.path)
    if (file) {
      if (res.success) {
        const newPath = file.path.replace(file.originalName, file.newName)
        successfulRenames.push({
          id: file.id,
          oldPath: file.path,
          newPath: newPath,
          originalName: file.originalName,
          newName: file.newName
        })
        fileStore.updateFileAfterRename(file.id, newPath, file.newName)
      } else {
        if (res.error === 'FILE_EXISTS') {
          conflictCount++
          fileStore.updateFileStatus(file.id, 'error', t('app.targetFileExists'))
        } else {
          fileStore.updateFileStatus(file.id, 'error', res.error)
        }
      }
    }
  })

  if (successfulRenames.length > 0) {
    fileStore.setLastRenameBatch(successfulRenames)

    const toastMessage = conflictCount > 0
      ? t('app.renamedSuccess') + ` (${t('app.renameConflict', { n: conflictCount })})`
      : t('app.renamedSuccess')

    // Show toast with Undo action
    toastStore.addToast(toastMessage, conflictCount > 0 ? 'warning' : 'success', 10000, {
      label: t('app.undo'),
      onClick: handleUndo
    })

    // Auto-disable all operations (layer visibility Concept)
    operationStore.operations.forEach(op => {
      op.enabled = false
    })
  } else if (conflictCount > 0) {
    toastStore.addToast(t('app.renameConflict', { n: conflictCount }), 'error', 5000)
  }

  isProcessing.value = false
}

async function handleUndo() {
  if (isProcessing.value || fileStore.lastRenameBatch.length === 0) return
  isProcessing.value = true

  const undoBatch = fileStore.lastRenameBatch.map(item => ({
    oldPath: item.newPath,
    newPath: item.oldPath
  }))

  // Skip files that would conflict with current files (e.g. if a new file took the old name)
  const currentPaths = new Set(fileStore.files.map(f => f.path))
  const safeUndoBatch = undoBatch.filter(item => !currentPaths.has(item.newPath))
  const skippedCount = undoBatch.length - safeUndoBatch.length

  if (skippedCount > 0) {
    fileStore.updateFileStatus(fileStore.lastRenameBatch[0].id, 'error', `Skipped ${skippedCount} files due to conflicts`) // Just a way to show error, maybe toast is better but this works for now
  }

  const results = await window.ipcRenderer.renameFiles(safeUndoBatch, { failOnExist: true })

  let conflictCount = 0
  results.forEach(res => {
    // Find the original item in history to get original ID and names
    // Note: res.path is the 'oldPath' of the undo operation, which is 'newPath' of the original rename
    const historyItem = fileStore.lastRenameBatch.find(h => h.newPath === res.path)
    if (historyItem) {
      const file = fileStore.files.find(f => f.id === historyItem.id)
      if (file) {
        if (res.success) {
          fileStore.updateFileAfterRename(file.id, historyItem.oldPath, historyItem.originalName)
          fileStore.updateNewName(file.id, historyItem.originalName) // Reset newName preview to match
        } else {
          if (res.error === 'FILE_EXISTS') {
            conflictCount++
            fileStore.updateFileStatus(file.id, 'error', t('app.targetFileExists'))
          } else {
            fileStore.updateFileStatus(file.id, 'error', res.error)
          }
        }
      }
    }
  })

  if (conflictCount > 0) {
    toastStore.addToast(t('app.undoConflict', { n: conflictCount }), 'error', 5000)
  } else {
    fileStore.clearUndo()
    toastStore.addToast(t('app.undoSuccess'), 'success', 3000)
  }
  isProcessing.value = false
}

async function handleCopyTo() {
  if (isProcessing.value) return

  const targetDir = await window.ipcRenderer.selectDirectory()
  if (!targetDir) return

  isProcessing.value = true

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
    <div v-if="isMac" class="drag-region fixed top-0 left-0 right-0 z-50 transition-all duration-200"
      :style="{ height: dragRegionHeight }">
    </div>

    <!-- Sidebar -->
    <aside :class="[
      'flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-xl transition-all duration-300 overflow-hidden',
      isSidebarCollapsed ? 'w-16' : 'w-80'
    ]">
      <!-- Collapsed state: only show toggle button -->
      <div v-if="isSidebarCollapsed" class="flex-1 flex items-center justify-center pt-14">
        <button @click="isSidebarCollapsed = false" :title="$t('app.showSidebar')"
          class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Expanded state: show full content -->
      <div v-else class="flex flex-col flex-1 min-w-80 h-full">
        <div
          class="p-6 pt-14 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between shrink-0">
          <div class="flex-1">
            <a href="#" @click.prevent="openExternal('https://renamer.junyou.tw')"
              class="block transition-opacity hover:opacity-80 cursor-pointer" title="https://renamer.junyou.tw">
              <h1
                class="text-xl font-bold bg-linear-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 bg-clip-text text-transparent">
                {{ $t('app.title') }}
              </h1>
            </a>
            <p class="text-xs text-slate-500 dark:text-slate-500 mt-1">{{ $t('app.subtitle') }}</p>
          </div>
          <div class="flex items-center gap-1">
            <button @click="showAbout = true" :title="$t('app.about')"
              class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button @click="showSettings = true" :title="$t('settings.title')"
              class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd"
                  d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                  clip-rule="evenodd" />
              </svg>
            </button>
            <button @click="isSidebarCollapsed = true" :title="$t('app.hideSidebar')"
              class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar min-h-0">
          <FileDropZone />
          <OperationPipeline :canUndo="fileStore.lastRenameBatch.length > 0" @undo="handleUndo" />
        </div>

        <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 space-y-3">
          <!-- Conflict Warning -->
          <div v-if="hasConflicts"
            class="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clip-rule="evenodd" />
            </svg>
            {{ $t('app.conflictDetected') }}
          </div>
          <div class="grid grid-cols-2 gap-3 mt-4">
            <button @click="handleRename" :disabled="isProcessing || fileStore.files.length === 0"
              class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2">
              <span v-if="isProcessing" class="animate-spin">⏳</span>
              {{ isProcessing ? $t('app.processing') : $t('app.rename') }}
            </button>
            <button @click="handleCopyTo" :disabled="isProcessing || fileStore.files.length === 0 || hasConflicts"
              class="px-4 py-2.5 bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              {{ isProcessing ? $t('app.processing') : $t('app.copyTo') }}
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col bg-white dark:bg-slate-950"
      :style="{ paddingTop: isMac ? dragRegionHeight : '0px' }">
      <!-- Update Banner -->
      <div v-if="updateAvailable"
        :class="['bg-blue-600 text-white px-4 py-3 flex items-center justify-between text-sm shadow-md z-40 shrink-0']">
        <div class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clip-rule="evenodd" />
          </svg>
          <span class="font-medium">{{ $t('app.updateAvailable') }} ({{ latestVersion }})</span>
        </div>
        <div class="flex items-center gap-4">
          <button @click="openReleasePage"
            class="bg-white text-blue-600 px-3 py-1 rounded font-bold hover:bg-blue-50 transition-colors cursor-pointer">
            {{ $t('app.download') }}
          </button>
          <button @click="updateAvailable = false" class="opacity-80 hover:opacity-100 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div class="flex-1 p-6 overflow-hidden min-w-0">
        <FilePreviewList />
      </div>
    </main>
    <ToastNotification />
    <AboutModal v-model="showAbout" />
    <SettingsModal v-model="showSettings" />
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
