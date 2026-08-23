<script setup lang="ts">
import { computed } from 'vue'
import { useFileStore } from '../stores/fileStore'
import { useOperationStore } from '../stores/operationStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useAiStore } from '../stores/aiStore'
import { useHistoryStore } from '../stores/historyStore'
import ProviderIcon from './icons/ProviderIcon.vue'
import {
  PanelLeft,
  Files,
  Folder,
  Layers,
  AlertTriangle,
  RotateCcw,
  Tag,
  History
} from 'lucide-vue-next'

defineProps<{
  isSidebarCollapsed: boolean
  hasConflicts?: boolean
  conflictMessage?: string
  version?: string
}>()

const emit = defineEmits<{
  (e: 'toggleSidebar'): void
  (e: 'undo'): void
  (e: 'openSettings'): void
  (e: 'openHistory'): void
}>()

const fileStore = useFileStore()
const operationStore = useOperationStore()
const settingsStore = useSettingsStore()
const aiStore = useAiStore()
const historyStore = useHistoryStore()

const fileCount = computed(() => fileStore.files.length)

const folderCount = computed(() => {
  if (fileStore.files.length === 0) return 0
  const dirs = new Set<string>()
  for (const f of fileStore.files) {
    const parts = f.path.split(/[/\\]/)
    if (parts.length > 1) {
      parts.pop()
      dirs.add(parts.join('/'))
    }
  }
  return dirs.size
})

const changedCount = computed(() => {
  return fileStore.files.filter(f => f.originalName !== f.newName).length
})

const totalRules = computed(() => operationStore.operations.length)
const activeRules = computed(() => operationStore.operations.filter(op => op.enabled).length)

const canUndo = computed(() => fileStore.lastRenameBatch.length > 0)

function toggleProcessFilenameOnly() {
  settingsStore.processFilenameOnly = !settingsStore.processFilenameOnly
}
</script>

<template>
  <footer
    class="h-6.5 bg-slate-100/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 px-2 flex items-center justify-between shrink-0 select-none z-20 overflow-hidden font-mono"
  >
    <!-- Left Section: Workspace & Stats -->
    <div class="flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-hidden">
      <!-- Toggle Sidebar Button -->
      <button
        type="button"
        @click="emit('toggleSidebar')"
        :title="$t('statusBar.toggleSidebar')"
        class="flex items-center justify-center p-0.5 rounded hover:bg-slate-200/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
        :class="{ 'text-blue-600 dark:text-blue-400': !isSidebarCollapsed }"
      >
        <PanelLeft class="w-3.5 h-3.5" />
      </button>

      <span class="w-px h-3 bg-slate-300 dark:bg-slate-700 shrink-0"></span>

      <!-- Files & Folders Count -->
      <div
        class="flex items-center gap-1 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300 shrink-0 font-sans"
        :title="`${fileCount} files in ${folderCount} folders`"
      >
        <Files class="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
        <span>{{ $t('statusBar.filesCount', { n: fileCount }) }}</span>
        <template v-if="folderCount > 1">
          <span class="text-slate-400 dark:text-slate-600 text-[10px]">(<Folder class="w-2.5 h-2.5 inline -mt-0.5" /> {{ folderCount }})</span>
        </template>
      </div>

      <!-- Changed Count Badge -->
      <div
        v-if="fileCount > 0"
        class="flex items-center gap-1 px-1.5 py-0.5 rounded font-sans text-[11px] shrink-0"
        :class="changedCount > 0 ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-slate-400 dark:text-slate-500'"
      >
        <span
          class="w-1.5 h-1.5 rounded-full shrink-0"
          :class="changedCount > 0 ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'"
        ></span>
        <span>{{ changedCount > 0 ? $t('statusBar.changedCount', { n: changedCount }) : $t('statusBar.noChanges') }}</span>
      </div>

      <!-- Conflict Warning Indicator -->
      <div
        v-if="hasConflicts"
        class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100/90 dark:bg-red-950/60 text-red-600 dark:text-red-400 font-semibold border border-red-300 dark:border-red-800/60 shrink-0 animate-pulse font-sans"
        :title="conflictMessage || $t('statusBar.conflictWarning', { n: '!' })"
      >
        <AlertTriangle class="w-3 h-3 text-red-500" />
        <span class="truncate max-w-40 sm:max-w-xs">{{ conflictMessage || $t('statusBar.conflictWarning', { n: '' }) }}</span>
      </div>

      <!-- Pipeline Rules Count -->
      <div
        class="hidden md:flex items-center gap-1 px-1 py-0.5 rounded text-slate-600 dark:text-slate-400 shrink-0 font-sans"
        :title="`${activeRules} active of ${totalRules} total rules`"
      >
        <Layers class="w-3 h-3 text-slate-400 dark:text-slate-500" />
        <span>{{ totalRules > 0 ? $t('statusBar.activeRules', { active: activeRules, total: totalRules }) : $t('statusBar.noRules') }}</span>
      </div>
    </div>

    <!-- Right Section: Scope, AI, Undo & Version -->
    <div class="flex items-center gap-1 sm:gap-2 shrink-0 overflow-hidden font-sans">
      <!-- Undo Shortcut Action -->
      <button
        v-if="canUndo"
        type="button"
        @click="emit('undo')"
        :title="$t('statusBar.undoAvailable')"
        class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/50 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors cursor-pointer text-[10.5px] font-medium"
      >
        <RotateCcw class="w-2.5 h-2.5" />
        <span>{{ $t('statusBar.undoAvailable') }}</span>
      </button>

      <!-- History Log Shortcut -->
      <button
        type="button"
        @click="emit('openHistory')"
        :title="$t('history.title')"
        class="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer text-slate-600 dark:text-slate-400 text-[10.5px]"
      >
        <History class="w-2.5 h-2.5 opacity-70" />
        <span>{{ $t('statusBar.history', { n: historyStore.batches.length }) }}</span>
      </button>

      <!-- Scope Switcher (Process Filename Only Toggle) -->
      <button
        type="button"
        @click="toggleProcessFilenameOnly"
        :title="$t('statusBar.scopeTooltip')"
        class="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer text-slate-600 dark:text-slate-400 text-[10.5px]"
      >
        <Tag class="w-2.5 h-2.5 opacity-70" />
        <span>{{ settingsStore.processFilenameOnly ? $t('statusBar.scopeFilename') : $t('statusBar.scopeFull') }}</span>
      </button>

      <span class="w-px h-3 bg-slate-300 dark:bg-slate-700"></span>

      <!-- AI Profile Status Pill -->
      <button
        type="button"
        @click="aiStore.toggleOpen"
        :title="aiStore.isOpen ? $t('ai.closePanel') : $t('ai.title')"
        class="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-200/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer text-[10.5px]"
        :class="{ 'bg-blue-100/60 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium': aiStore.isOpen }"
      >
        <ProviderIcon :provider="aiStore.activeProfile.provider" class="w-3 h-3 shrink-0" />
        <span class="hidden sm:inline max-w-28 truncate">{{ aiStore.activeProfile.name }}</span>
        <span
          class="w-1.5 h-1.5 rounded-full shrink-0"
          :class="{
            'bg-emerald-500': aiStore.status?.ready,
            'bg-amber-500 animate-pulse': aiStore.isCheckingStatus,
            'bg-red-400': !aiStore.status?.ready && !aiStore.isCheckingStatus
          }"
        ></span>
      </button>

      <!-- App Version -->
      <span
        v-if="version"
        class="hidden lg:inline text-slate-400 dark:text-slate-500 font-mono text-[10px] pl-1"
      >
        v{{ version }}
      </span>
    </div>
  </footer>
</template>
