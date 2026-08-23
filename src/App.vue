<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OperationPipeline from './components/OperationPipeline.vue'
import FilePreviewList from './components/FilePreviewList.vue'
import ToastNotification from './components/ToastNotification.vue'
import AboutModal from './components/AboutModal.vue'
import SettingsModal from './components/SettingsModal.vue'
import AiAssistantPanel from './components/AiAssistantPanel.vue'
import StatusBar from './components/StatusBar.vue'
import HistoryModal from './components/HistoryModal.vue'
import { useFileStore } from './stores/fileStore'
import { useOperationStore } from './stores/operationStore'
import { useSettingsStore } from './stores/settingsStore'
import { useToastStore } from './stores/toastStore'
import { useThemeStore } from './stores/themeStore'
import { useAiStore } from './stores/aiStore'
import { useHistoryStore, type RenameFileLog } from './stores/historyStore'
import { CircleAlert, History, Info, LoaderCircle, PanelLeft, Settings, Sparkles, X, Puzzle } from 'lucide-vue-next'
import PluginModal from './components/PluginModal.vue'

import { getLatestRelease, getReleasePageUrl, isNewerVersion, normalizeReleaseVersion } from './services/updateService'
import { generateRenamePreviewAsync } from './services/renameEngine'
import { replaceBasename } from './utils/path'
import { desktop, type DesktopRuntimeInfo } from './services/desktop'

const fileStore = useFileStore()
const operationStore = useOperationStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()
const aiStore = useAiStore()
const historyStore = useHistoryStore()
useThemeStore()
const { t } = useI18n()
const isProcessing = ref(false)
const isInstallingUpdate = ref(false)
const isSidebarCollapsed = ref(false)
const isMac = ref(false)
const macTrafficLightsPadding = computed(() => {
  if (!isMac.value) return '4px'
  const zoomFactor = Math.max(0.5, (settingsStore.zoomLevel || 100) / 100)
  return `${Math.round(72 / zoomFactor)}px`
})
const runtimeInfo = ref<DesktopRuntimeInfo | null>(null)
const showAbout = ref(false)
const aboutInitialView = ref<'about' | 'changelog'>('about')
const aboutInitialReleaseTag = ref<string | null>(null)
const postUpdateVersion = ref<string | null>(null)
const showSettings = ref(false)
const showHistory = ref(false)
const showPlugins = ref(false)
const isFileDragActive = ref(false)
let unlistenFileDrop: null | (() => void) = null
let unlistenFileDragState: null | (() => void) = null


const processFilenameOnly = computed(() => settingsStore.processFilenameOnly)
const hasConflicts = ref(false)
const conflictMessage = ref('')

const updateAvailable = ref(false)
const latestVersion = ref('')
const releaseUrl = ref('')
const PENDING_UPDATED_VERSION_KEY = 'regex-batch-renamer:pending-updated-version'

function getResolvedReleaseUrl() {
  return releaseUrl.value || getReleasePageUrl()
}

function getInAppUpdateBlockedReason() {
  if (runtimeInfo.value?.runtime !== 'tauri' || runtimeInfo.value.platform !== 'darwin') return null
  if (runtimeInfo.value.appBundleParentWritable === false) {
    return t('about.updateInstallBlockedMac')
  }
  return null
}

function fallbackToReleaseDownload(message: string) {
  const url = getResolvedReleaseUrl()
  toastStore.addToast(message, 'error', 6000, {
    label: t('about.downloadUpdate'),
    onClick: () => openExternal(url),
  })
  openExternal(url)
}

async function checkForUpdates() {
  try {
    updateAvailable.value = false

    if (runtimeInfo.value?.runtime === 'tauri' && desktop.checkForAppUpdate) {
      const appUpdate = await desktop.checkForAppUpdate()
      if (appUpdate?.available) {
        const release = await getLatestRelease({
          channel: runtimeInfo.value?.channel,
        })
        updateAvailable.value = true
        latestVersion.value = normalizeReleaseVersion(appUpdate.version ?? release?.tagName ?? '')
        releaseUrl.value = release?.htmlUrl ?? getReleasePageUrl()
        return
      }
    }

    const release = await getLatestRelease({
      channel: runtimeInfo.value?.channel,
    })
    if (!release) return

    const remoteVersion = normalizeReleaseVersion(release.tagName)
    const installedVersion = runtimeInfo.value?.version ?? ''

    if (installedVersion && isNewerVersion(installedVersion, remoteVersion)) {
      updateAvailable.value = true
      latestVersion.value = remoteVersion
      releaseUrl.value = release.htmlUrl || getReleasePageUrl()
    }
  } catch (e) {
    console.error('Update check failed:', e)
  }
}

async function maybeShowPostUpdateNotes() {
  const url = new URL(window.location.href)
  const devInjectedVersion = import.meta.env.DEV ? url.searchParams.get('updatedVersion') : null
  const pendingVersion = devInjectedVersion || localStorage.getItem(PENDING_UPDATED_VERSION_KEY)
  if (!pendingVersion) return

  const installedVersion = runtimeInfo.value?.version ?? ''
  if (!devInjectedVersion && (!installedVersion || installedVersion !== pendingVersion)) return

  postUpdateVersion.value = pendingVersion
  aboutInitialView.value = 'changelog'
  aboutInitialReleaseTag.value = `v${pendingVersion}`
  showAbout.value = true
  if (devInjectedVersion) {
    url.searchParams.delete('updatedVersion')
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  } else {
    localStorage.removeItem(PENDING_UPDATED_VERSION_KEY)
  }
}

function openAboutModal() {
  aboutInitialView.value = 'about'
  aboutInitialReleaseTag.value = null
  postUpdateVersion.value = null
  showAbout.value = true
}

async function openReleasePage() {
  const blockedReason = getInAppUpdateBlockedReason()
  if (blockedReason) {
    fallbackToReleaseDownload(blockedReason)
    return
  }

  if (runtimeInfo.value?.runtime === 'tauri' && desktop.installAppUpdate) {
    try {
      isInstallingUpdate.value = true
      if (latestVersion.value) {
        localStorage.setItem(PENDING_UPDATED_VERSION_KEY, latestVersion.value)
      }
      await desktop.installAppUpdate()
      return
    } catch (e) {
      localStorage.removeItem(PENDING_UPDATED_VERSION_KEY)
      console.error('Tauri update install failed:', e)
      fallbackToReleaseDownload(t('about.updateInstallFailedFallback'))
    } finally {
      isInstallingUpdate.value = false
    }
  }

  openExternal(getResolvedReleaseUrl())
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

  await maybeShowPostUpdateNotes()
  checkForUpdates()
  settingsStore.initZoom()
  window.addEventListener('keydown', handleGlobalKeydown)
  void desktop.setPendingChangesHandler(
    () => {
      return fileStore.files.some(f => f.originalName !== f.newName)
    },
    {
      title: t('app.pendingCloseTitle'),
      message: t('app.pendingCloseMessage'),
      okLabel: t('app.exit'),
      cancelLabel: t('common.cancel'),
    }
  )

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
  // Handle DevTools: F12 or Cmd/Ctrl + Option/Alt + I
  if (e.key === 'F12' || ((e.metaKey || e.ctrlKey) && (e.altKey || e.shiftKey) && (e.key === 'i' || e.key === 'I'))) {
    e.preventDefault()
    void desktop.openDevTools?.()
    return
  }

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

const updatePreviews = debounce(async () => {
  if (fileStore.files.length === 0) {
    hasConflicts.value = false
    conflictMessage.value = ''
    return
  }

  const preview = await generateRenamePreviewAsync(
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
  const fileLogs: RenameFileLog[] = []

  let conflictCount = 0
  let failedCount = 0
  let successCount = 0

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
        fileLogs.push({
          id: file.id,
          oldPath: file.path,
          newPath: newPath,
          originalName: file.originalName,
          newName: file.newName,
          status: 'success'
        })
        successCount++
        fileStore.updateFileAfterRename(file.id, newPath, file.newName)
      } else {
        const isConflict = res.code === 'FILE_EXISTS' || res.error === 'FILE_EXISTS'
        if (isConflict) {
          conflictCount++
          fileStore.updateFileStatus(file.id, 'error', t('app.targetFileExists'))
        } else {
          failedCount++
          fileStore.updateFileStatus(file.id, 'error', res.error)
        }
        fileLogs.push({
          id: file.id,
          oldPath: file.path,
          newPath: replaceBasename(file.path, file.newName),
          originalName: file.originalName,
          newName: file.newName,
          status: isConflict ? 'conflict' : 'failed',
          error: isConflict ? t('app.targetFileExists') : res.error
        })
      }
    }
  })

  // Record to History Store
  historyStore.addBatchLog({
    action: 'rename',
    totalFiles: fileStore.files.length,
    successCount,
    failedCount,
    conflictCount,
    rulesSnapshot: operationStore.getSnapshot(),
    files: fileLogs
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
    fileStore.updateFileStatus(fileStore.lastRenameBatch[0].id, 'error', `Skipped ${skippedCount} files due to conflicts`)
  }

  const results = await desktop.renameFiles(safeUndoBatch, { failOnExist: true })
  const fileLogs: RenameFileLog[] = []

  let conflictCount = 0
  let failedCount = 0
  let successCount = 0

  results.forEach(res => {
    const historyItem = fileStore.lastRenameBatch.find(h => h.newPath === res.path)
    if (historyItem) {
      const file = fileStore.files.find(f => f.id === historyItem.id)
      if (file) {
        if (res.success) {
          fileStore.updateFileAfterRename(file.id, historyItem.oldPath, historyItem.originalName)
          fileStore.updateNewName(file.id, historyItem.originalName)
          fileLogs.push({
            id: file.id,
            oldPath: historyItem.newPath,
            newPath: historyItem.oldPath,
            originalName: historyItem.newName,
            newName: historyItem.originalName,
            status: 'undone'
          })
          successCount++
        } else {
          const isConflict = res.code === 'FILE_EXISTS' || res.error === 'FILE_EXISTS'
          if (isConflict) {
            conflictCount++
            fileStore.updateFileStatus(file.id, 'error', t('app.targetFileExists'))
          } else {
            failedCount++
            fileStore.updateFileStatus(file.id, 'error', res.error)
          }
          fileLogs.push({
            id: file.id,
            oldPath: historyItem.newPath,
            newPath: historyItem.oldPath,
            originalName: historyItem.newName,
            newName: historyItem.originalName,
            status: isConflict ? 'conflict' : 'failed',
            error: isConflict ? t('app.targetFileExists') : res.error
          })
        }
      }
    }
  })

  // Record to History Store
  historyStore.addBatchLog({
    action: 'undo',
    totalFiles: undoBatch.length,
    successCount,
    failedCount,
    conflictCount,
    files: fileLogs
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
  const fileLogs: RenameFileLog[] = []

  let successCount = 0
  let failedCount = 0

  results.forEach(res => {
    const file = fileStore.files.find(f => f.path === res.path)
    if (file) {
      if (res.success) {
        successCount++
        fileStore.updateFileStatus(file.id, 'success')
        fileLogs.push({
          id: file.id,
          oldPath: file.path,
          newPath: `${targetDir}${separator}${file.newName}`,
          originalName: file.originalName,
          newName: file.newName,
          status: 'success'
        })
      } else {
        failedCount++
        fileStore.updateFileStatus(file.id, 'error', res.error)
        fileLogs.push({
          id: file.id,
          oldPath: file.path,
          newPath: `${targetDir}${separator}${file.newName}`,
          originalName: file.originalName,
          newName: file.newName,
          status: 'failed',
          error: res.error
        })
      }
    }
  })

  // Record to History Store
  historyStore.addBatchLog({
    action: 'copy',
    totalFiles: fileStore.files.length,
    successCount,
    failedCount,
    conflictCount: 0,
    rulesSnapshot: operationStore.getSnapshot(),
    files: fileLogs
  })

  isProcessing.value = false
}
</script>

<template>
  <div
    class="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-200 font-sans selection:bg-blue-200 dark:selection:bg-blue-500/30 selection:text-blue-900 dark:selection:text-blue-200 transition-colors select-none overflow-hidden">
    <!-- Unified Top Toolbar (macOS native 34px height) -->
    <header
      data-tauri-drag-region
      class="h-[34px] w-full shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-xl px-3 z-30 select-none"
    >
      <!-- Left Section: Traffic Lights Safe Area + 常駐收合按鈕 (w-6 h-6 像素級垂直中心對齊) -->
      <div class="flex items-center no-drag" :style="{ paddingLeft: macTrafficLightsPadding }">
        <button
          @click="isSidebarCollapsed = !isSidebarCollapsed"
          :title="isSidebarCollapsed ? $t('app.showSidebar') : $t('app.hideSidebar')"
          class="w-6 h-6 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer flex items-center justify-center"
        >
          <PanelLeft class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Center Section: Drag Region -->
      <div data-tauri-drag-region class="flex-1 h-full"></div>

      <!-- Right Section: Update Pill + Info + Settings (統一 24x24px) -->
      <div class="flex items-center gap-1.5 no-drag">
        <!-- Floating Update Pill inside Header -->
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 -translate-y-2 scale-95"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 -translate-y-2 scale-95"
        >
          <div
            v-if="updateAvailable"
            class="flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-600/90 dark:bg-blue-600/85 backdrop-blur-md text-white shadow-xs border border-blue-400/30 text-xs font-medium mr-1"
          >
            <span class="flex h-2 w-2 relative">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
            </span>
            <span class="text-[11px] font-bold">v{{ latestVersion }}</span>
            <button
              @click="openReleasePage"
              :disabled="isInstallingUpdate"
              class="bg-white text-blue-700 hover:bg-blue-50 px-2 py-0.5 rounded-full text-[11px] font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <LoaderCircle v-if="isInstallingUpdate" class="w-3 h-3 animate-spin" />
              {{ isInstallingUpdate ? $t('app.processing') : $t('app.download') }}
            </button>
            <button
              @click="updateAvailable = false"
              class="p-0.5 rounded-full hover:bg-blue-500/50 transition-colors opacity-80 hover:opacity-100 cursor-pointer"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </Transition>

        <button
          @click="aiStore.toggleOpen"
          :title="aiStore.isOpen ? $t('ai.closePanel') : $t('ai.title')"
          :class="[
            'flex items-center gap-1.5 px-2.5 h-6 rounded-md text-xs font-semibold transition-colors cursor-pointer mr-1',
            aiStore.isOpen
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-300 dark:border-blue-700 shadow-2xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-slate-100'
          ]"
        >
          <Sparkles class="w-3.5 h-3.5" :class="aiStore.isOpen ? 'text-blue-600 dark:text-blue-400' : ''" />
          <span class="hidden sm:inline">{{ $t('ai.assistantBtn') }}</span>
        </button>

        <button
          @click="showPlugins = true"
          :title="$t('plugins.title')"
          class="w-6 h-6 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer flex items-center justify-center relative"
        >
          <Puzzle class="w-3.5 h-3.5" />
        </button>

        <button
          @click="showHistory = true"
          :title="$t('history.title')"
          class="w-6 h-6 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer flex items-center justify-center relative"
        >
          <History class="w-3.5 h-3.5" />
        </button>

        <button
          @click="openAboutModal"
          :title="$t('app.about')"
          class="w-6 h-6 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer flex items-center justify-center relative"
        >
          <Info class="w-3.5 h-3.5" />
          <span v-if="updateAvailable" class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-500 ring-1 ring-slate-100 dark:ring-slate-900 animate-pulse"></span>
        </button>

        <button
          @click="showSettings = true"
          :title="$t('settings.title')"
          class="w-6 h-6 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer flex items-center justify-center"
        >
          <Settings class="w-3.5 h-3.5" />
        </button>
      </div>
    </header>

    <!-- App Body: Sidebar + Main Content + Right AI Panel -->
    <div class="flex flex-1 overflow-hidden min-h-0">
      <!-- Left Sidebar: Operations (完全收合時寬度為 0，展開時 w-80，平滑過渡) -->
      <aside :class="[
        'flex flex-col border-r border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-xl transition-all duration-300 overflow-hidden shrink-0',
        isSidebarCollapsed ? 'w-0 border-r-0' : 'w-80'
      ]">
        <div class="flex flex-col flex-1 min-w-80 h-full min-h-0 overflow-hidden">
          <!-- Sidebar Brand Title (Fixed Header 1) -->
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <a href="#" @click.prevent="openExternal('https://renamer.junyou.tw')"
              class="block transition-opacity hover:opacity-80 cursor-pointer" title="https://renamer.junyou.tw">
              <h1
                class="text-lg font-bold bg-linear-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-300 bg-clip-text text-transparent leading-snug">
                {{ $t('app.title') }}
              </h1>
            </a>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ $t('app.subtitle') }}</p>
          </div>

          <!-- Operation Pipeline (Fixed Header 2 + Scrollable Rule List) -->
          <OperationPipeline :canUndo="fileStore.lastRenameBatch.length > 0" @undo="handleUndo" />

          <!-- Action Buttons (Rename / CopyTo) -->
          <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 space-y-3 shrink-0">
            <!-- Conflict Warning -->
            <div v-if="hasConflicts"
              class="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1 animate-pulse">
              <CircleAlert class="w-4 h-4" />
              {{ conflictMessage }}
            </div>
            <div class="grid grid-cols-2 gap-3">
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

      <!-- Main Content File List -->
      <main class="flex-1 flex flex-col bg-white dark:bg-slate-950 p-4 sm:p-5 overflow-hidden min-w-0">
        <FilePreviewList :is-file-drag-active="isFileDragActive" />
      </main>

      <!-- Right Sidebar: AI Assistant Panel (完全收合時寬度為 0，展開時 w-96，平滑過渡) -->
      <aside :class="[
        'flex flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 backdrop-blur-xl transition-all duration-300 overflow-hidden shrink-0',
        aiStore.isOpen ? 'w-96' : 'w-0 border-l-0'
      ]">
        <AiAssistantPanel @open-settings="showSettings = true" />
      </aside>
    </div>

    <!-- Bottom Status Bar -->
    <StatusBar
      :is-sidebar-collapsed="isSidebarCollapsed"
      :has-conflicts="hasConflicts"
      :conflict-message="conflictMessage"
      :version="runtimeInfo?.version"
      @toggle-sidebar="isSidebarCollapsed = !isSidebarCollapsed"
      @undo="handleUndo"
      @open-settings="showSettings = true"
      @open-history="showHistory = true"
      @open-plugins="showPlugins = true"
    />

    <ToastNotification />
  <AboutModal
    v-model="showAbout"
    :initial-view="aboutInitialView"
    :initial-release-tag="aboutInitialReleaseTag"
    :post-update-version="postUpdateVersion"
  />
    <SettingsModal v-model="showSettings" />
    <HistoryModal v-model="showHistory" />
    <PluginModal v-model="showPlugins" />
  </div>
</template>

<style>
/* Global drag region styling */
[data-tauri-drag-region] {
  -webkit-app-region: drag;
}

button,
a,
input,
select,
textarea,
[data-tauri-drag-region="false"],
.no-drag {
  -webkit-app-region: no-drag;
}

/* Global scrollbar styling */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(71, 85, 105, 0.4);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.7);
}

/* Hide scrollbar utility */
.no-scrollbar::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
