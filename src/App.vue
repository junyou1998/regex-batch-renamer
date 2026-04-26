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
import { useThemeStore } from './stores/themeStore'
import { ChevronsLeft, ChevronsRight, CircleAlert, Info, LoaderCircle, Settings, X } from 'lucide-vue-next'

// @ts-ignore
import { version as currentVersion } from '../package.json'
import { getLatestRelease } from './services/updateService'
import { generateRenamePreview } from './services/renameEngine'
import { replaceBasename } from './utils/path'
import { desktop, type DesktopRuntimeInfo } from './services/desktop'

const fileStore = useFileStore()
const operationStore = useOperationStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()
useThemeStore()
const { t } = useI18n()
const isProcessing = ref(false)
const isInstallingUpdate = ref(false)
const isSidebarCollapsed = ref(false)
const isMac = ref(false)
const runtimeInfo = ref<DesktopRuntimeInfo | null>(null)
const showAbout = ref(false)
const showSettings = ref(false)
const isFileDragActive = ref(false)
let unlistenFileDrop: null | (() => void) = null
let unlistenFileDragState: null | (() => void) = null

const dragRegionHeight = computed(() => {
  if (!isMac.value) return '0px'
  const visualHeight = 32
  const zoomFactor = settingsStore.zoomLevel / 100
  return `${visualHeight / zoomFactor}px`
})

const processFilenameOnly = computed(() => settingsStore.processFilenameOnly)
const hasConflicts = ref(false)
const conflictMessage = ref('')

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
    const release = await getLatestRelease({
      channel: runtimeInfo.value?.channel,
    })
    if (!release) return

    if (runtimeInfo.value?.runtime === 'tauri' && runtimeInfo.value.channel === 'beta' && desktop.checkForAppUpdate) {
      const appUpdate = await desktop.checkForAppUpdate()
      if (appUpdate?.available) {
        updateAvailable.value = true
        latestVersion.value = appUpdate.version ?? release.tagName
        releaseUrl.value = release.htmlUrl
      }
      return
    }

    const remoteVersion = release.tagName.replace(/^beta-v|^v/, '')

    if (isNewerVersion(currentVersion, remoteVersion)) {
      updateAvailable.value = true
      latestVersion.value = release.tagName
      releaseUrl.value = release.htmlUrl
    }
  } catch (e) {
    console.error('Update check failed:', e)
  }
}

async function openReleasePage() {
  if (runtimeInfo.value?.runtime === 'tauri' && runtimeInfo.value.channel === 'beta' && desktop.installAppUpdate) {
    try {
      isInstallingUpdate.value = true
      await desktop.installAppUpdate()
      return
    } catch (e) {
      console.error('Tauri update install failed:', e)
    } finally {
      isInstallingUpdate.value = false
    }
  }

  if (releaseUrl.value) {
    openExternal(releaseUrl.value)
  }
}

function openExternal(url: string) {
  void desktop.openExternal(url)
}

function addDroppedFiles(paths: string[]) {
  if (paths.length === 0) return
  isFileDragActive.value = false
  fileStore.addFilePaths(paths)
}

onMounted(async () => {
  runtimeInfo.value = await desktop.getRuntimeInfo()
  isMac.value = runtimeInfo.value.platform === 'darwin'

  checkForUpdates()
  settingsStore.initZoom()
  window.addEventListener('keydown', handleGlobalKeydown)
  void desktop.setPendingChangesHandler(() => {
    return fileStore.files.some(f => f.originalName !== f.newName)
  })

  if (desktop.onFilesDropped) {
    try {
      unlistenFileDrop = await desktop.onFilesDropped(addDroppedFiles)
    } catch (error) {
      console.error('Failed to register file drop handler:', error)
      toastStore.addToast(t('dropZone.openFailed'), 'error')
    }
  }

  if (desktop.onFileDragStateChanged) {
    try {
      unlistenFileDragState = await desktop.onFileDragStateChanged((isDragging) => {
        isFileDragActive.value = isDragging
      })
    } catch (error) {
      console.error('Failed to register file drag state handler:', error)
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  void desktop.clearPendingChangesHandler()
  if (unlistenFileDrop) {
    unlistenFileDrop()
    unlistenFileDrop = null
  }
  if (unlistenFileDragState) {
    unlistenFileDragState()
    unlistenFileDragState = null
  }
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
  if (fileStore.files.length === 0) {
    hasConflicts.value = false
    conflictMessage.value = ''
    return
  }

  const preview = generateRenamePreview(
    fileStore.files,
    operationStore.operations,
    { processFilenameOnly: processFilenameOnly.value }
  )

  const fileMap = new Map(fileStore.files.map(file => [file.id, file]))

  preview.items.forEach(item => {
    const file = fileMap.get(item.id)
    if (!file) return

    if (item.issue === 'invalid-char') {
      fileStore.updateFileStatus(file.id, 'error', t('app.invalidChar'))
    } else if (item.issue === 'duplicate') {
      fileStore.updateFileStatus(file.id, 'error', t('app.conflictDetected'))
    } else if (file.status === 'error') {
      fileStore.updateFileStatus(file.id, 'idle')
    }

    if (file.newName !== item.newName) {
      fileStore.updateNewName(file.id, item.newName)
    }
  })

  hasConflicts.value = preview.hasConflicts
  if (preview.hasConflicts) {
    conflictMessage.value = preview.conflictReason === 'invalid-char'
      ? t('app.invalidChar')
      : t('app.conflictDetected')
  } else {
    conflictMessage.value = t('app.conflictDetected')
  }
}, 300)

watch(
  [() => fileStore.files, () => operationStore.operations, processFilenameOnly],
  () => {
    updatePreviews()
  },
  { deep: true }
)

async function handleRename() {
  if (isProcessing.value) return
  isProcessing.value = true

  const filesToRename = fileStore.files.map(f => ({
    oldPath: f.path,
    newPath: replaceBasename(f.path, f.newName)
  }))

  const results = await desktop.renameFiles(filesToRename, { failOnExist: true })
  const successfulRenames: { id: string; oldPath: string; newPath: string; originalName: string; newName: string }[] = []

  let conflictCount = 0
  results.forEach(res => {
    const file = fileStore.files.find(f => f.path === res.path)
    if (file) {
      if (res.success) {
        const newPath = replaceBasename(file.path, file.newName)
        successfulRenames.push({
          id: file.id,
          oldPath: file.path,
          newPath: newPath,
          originalName: file.originalName,
          newName: file.newName
        })
        fileStore.updateFileAfterRename(file.id, newPath, file.newName)
      } else {
        if (res.code === 'FILE_EXISTS' || res.error === 'FILE_EXISTS') {
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

  const results = await desktop.renameFiles(safeUndoBatch, { failOnExist: true })

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
          if (res.code === 'FILE_EXISTS' || res.error === 'FILE_EXISTS') {
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

  let targetDir: string | undefined
  try {
    targetDir = await desktop.selectDirectory()
  } catch (error) {
    console.error('Failed to select directory:', error)
    toastStore.addToast(t('errors.selectDirectoryFailed'), 'error')
    return
  }

  if (!targetDir) return

  isProcessing.value = true

  const separator = targetDir.includes('\\') ? '\\' : '/'

  const filesToCopy = fileStore.files.map(f => ({
    oldPath: f.path,
    newPath: `${targetDir}${separator}${f.newName}`
  }))

  const results = await desktop.copyRenameFiles(filesToCopy)

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
    <div v-if="isMac" class="drag-region fixed top-0 right-0 z-50 transition-all duration-200"
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
          <ChevronsRight class="w-5 h-5" />
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
              <Info class="w-5 h-5" />
            </button>
            <button @click="showSettings = true" :title="$t('settings.title')"
              class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <Settings class="w-5 h-5" />
            </button>
            <button @click="isSidebarCollapsed = true" :title="$t('app.hideSidebar')"
              class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <ChevronsLeft class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar min-h-0">
          <div class="p-4 pb-0">
            <FileDropZone :is-file-drag-active="isFileDragActive" />
          </div>
          <div class="p-4 pt-6">
            <OperationPipeline :canUndo="fileStore.lastRenameBatch.length > 0" @undo="handleUndo" />
          </div>
        </div>

        <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 space-y-3">
          <!-- Conflict Warning -->
          <div v-if="hasConflicts"
            class="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1 animate-pulse">
            <CircleAlert class="w-4 h-4" />
            {{ conflictMessage }}
          </div>
          <div class="grid grid-cols-2 gap-3 mt-4">
            <button @click="handleRename" :disabled="isProcessing || fileStore.files.length === 0 || hasConflicts"
              class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2">
              <LoaderCircle v-if="isProcessing" class="w-4 h-4 animate-spin" />
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
          <Info class="w-5 h-5" />
          <span class="font-medium">{{ $t('app.updateAvailable') }} ({{ latestVersion }})</span>
        </div>
        <div class="flex items-center gap-4">
          <button @click="openReleasePage"
            :disabled="isInstallingUpdate"
            class="bg-white text-blue-600 px-3 py-1 rounded font-bold hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
            {{ isInstallingUpdate ? $t('app.processing') : $t('app.download') }}
          </button>
          <button @click="updateAvailable = false" class="opacity-80 hover:opacity-100 cursor-pointer">
            <X class="w-5 h-5" />
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
  left: 80px;
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
