<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHistoryStore, type RenameBatchLog, type RenameFileLog } from '../stores/historyStore'
import { useOperationStore } from '../stores/operationStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useToastStore } from '../stores/toastStore'
import { desktop } from '../services/desktop'
import {
  X,
  History,
  FileSpreadsheet,
  FileCode,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Layers,
  ArrowRight,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  FolderSymlink,
  Download,
  ChevronDown
} from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'reapplyRules', rules: Array<{ type: string; params: Record<string, any> }>): void
}>()

const { t } = useI18n()
const historyStore = useHistoryStore()
const operationStore = useOperationStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()

const selectedBatchId = ref<string | null>(null)
const searchQuery = ref('')
const statusFilter = ref<'all' | 'success' | 'failed'>('all')
const showRulesSnapshot = ref(false)
const copiedBatchId = ref(false)
const isMaximized = ref(false)
const isMac = ref(false)

const showExportAllMenu = ref(false)
const showBatchExportMenu = ref(false)

function handleGlobalClick() {
  showExportAllMenu.value = false
  showBatchExportMenu.value = false
}

onMounted(async () => {
  window.addEventListener('click', handleGlobalClick)
  try {
    const info = await desktop.getRuntimeInfo()
    isMac.value = info.platform === 'darwin'
  } catch (e) {
    isMac.value = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac')
  }
})

onUnmounted(() => {
  window.removeEventListener('click', handleGlobalClick)
})

const macTrafficLightsPadding = computed(() => {
  if (!isMac.value || !isMaximized.value) return '0px'
  const zoomFactor = Math.max(0.5, (settingsStore.zoomLevel || 100) / 100)
  return `${Math.round(72 / zoomFactor)}px`
})

// Select first batch automatically when opened or when batches change
watch(
  () => [props.modelValue, historyStore.batches.length],
  ([isOpen]) => {
    if (isOpen && historyStore.batches.length > 0) {
      if (!selectedBatchId.value || !historyStore.batches.some(b => b.id === selectedBatchId.value)) {
        selectedBatchId.value = historyStore.batches[0].id
      }
    }
  },
  { immediate: true }
)

const selectedBatch = computed<RenameBatchLog | undefined>(() => {
  return historyStore.batches.find(b => b.id === selectedBatchId.value) || historyStore.batches[0]
})

const filteredFiles = computed<RenameFileLog[]>(() => {
  if (!selectedBatch.value) return []
  let list = selectedBatch.value.files

  // Status Filter
  if (statusFilter.value === 'success') {
    list = list.filter(f => f.status === 'success' || f.status === 'undone')
  } else if (statusFilter.value === 'failed') {
    list = list.filter(f => f.status === 'failed' || f.status === 'conflict')
  }

  // Search Filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(f =>
      f.originalName.toLowerCase().includes(q) ||
      f.newName.toLowerCase().includes(q) ||
      f.oldPath.toLowerCase().includes(q) ||
      f.newPath.toLowerCase().includes(q) ||
      (f.error && f.error.toLowerCase().includes(q))
    )
  }

  return list
})

function formatDate(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const Y = d.getFullYear()
  const M = pad(d.getMonth() + 1)
  const D = pad(d.getDate())
  const h = pad(d.getHours())
  const m = pad(d.getMinutes())
  const s = pad(d.getSeconds())
  return `${Y}/${M}/${D} ${h}:${m}:${s}`
}

function handleCopyBatchId(id: string) {
  navigator.clipboard.writeText(id)
  copiedBatchId.value = true
  setTimeout(() => {
    copiedBatchId.value = false
  }, 2000)
}

async function handleExportBatchCsv(batch?: RenameBatchLog) {
  if (!batch) return
  showBatchExportMenu.value = false
  const result = await historyStore.exportAsCsv(batch)
  if (result) {
    toastStore.addToast(t('history.exportSuccess'), 'success', 3000)
  }
}

async function handleExportBatchJson(batch?: RenameBatchLog) {
  if (!batch) return
  showBatchExportMenu.value = false
  const result = await historyStore.exportAsJson(batch)
  if (result) {
    toastStore.addToast(t('history.exportSuccess'), 'success', 3000)
  }
}

async function handleExportAllCsv() {
  showExportAllMenu.value = false
  const result = await historyStore.exportAsCsv(undefined)
  if (result) {
    toastStore.addToast(t('history.exportSuccess'), 'success', 3000)
  }
}

async function handleExportAllJson() {
  showExportAllMenu.value = false
  const result = await historyStore.exportAsJson(undefined)
  if (result) {
    toastStore.addToast(t('history.exportSuccess'), 'success', 3000)
  }
}

function handleDeleteBatch(batchId: string) {
  if (window.confirm(t('history.deleteBatchConfirm'))) {
    historyStore.deleteBatch(batchId)
    if (selectedBatchId.value === batchId) {
      selectedBatchId.value = historyStore.batches.length > 0 ? historyStore.batches[0].id : null
    }
    toastStore.addToast(t('history.deleteBatchSuccess'), 'info', 2500)
  }
}

function handleClearAllHistory() {
  if (window.confirm(t('history.clearConfirm'))) {
    historyStore.clearHistory()
    selectedBatchId.value = null
    toastStore.addToast(t('history.clearSuccess'), 'info', 2500)
  }
}

function handleReapplyRules(batch: RenameBatchLog) {
  if (!batch.rulesSnapshot || batch.rulesSnapshot.length === 0) return
  operationStore.operations = batch.rulesSnapshot.map((r, idx) => ({
    id: `reapplied-${Date.now()}-${idx}`,
    type: r.type as any,
    enabled: r.enabled !== false,
    params: { ...r.params }
  }))
  toastStore.addToast(t('history.reapplySuccess'), 'success', 3000)
  emit('update:modelValue', false)
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in transition-all"
      :class="isMaximized ? 'p-0' : 'p-3 sm:p-5'"
      @click.self="close"
    >
      <div
        class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-200 transition-all duration-200"
        :class="[
          isMaximized
            ? 'w-full h-full max-w-none max-h-none rounded-none'
            : 'w-full max-w-5xl h-[88vh] max-h-[820px] rounded-2xl'
        ]"
      >
        <!-- Modal Header -->
        <header
          data-tauri-drag-region
          class="relative z-30 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl select-none"
          :class="[
            isMaximized ? 'h-[36px] py-0' : 'py-2.5'
          ]"
        >
          <!-- Left Section: Traffic Lights Safe Area + Modal Title -->
          <div
            class="flex items-center gap-2.5 no-drag shrink-0"
            :style="{ paddingLeft: isMaximized ? macTrafficLightsPadding : '0px' }"
          >
            <div class="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <History class="w-4 h-4" />
            </div>
            <div>
              <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {{ $t('history.title') }}
                <span v-if="historyStore.batches.length > 0" class="text-xs font-normal text-slate-400">
                  ({{ historyStore.batches.length }} {{ $t('history.batches') }})
                </span>
              </h2>
            </div>
          </div>

          <!-- Center Drag Region -->
          <div data-tauri-drag-region class="flex-1 h-full min-w-4"></div>

          <!-- Header Right Actions: 全域整體操作 -->
          <div class="flex items-center gap-1.5 sm:gap-2 no-drag shrink-0">
            <template v-if="historyStore.batches.length > 0">
              <!-- Export All Dropdown Button -->
              <div class="relative">
                <button
                  type="button"
                  @click.stop="showExportAllMenu = !showExportAllMenu"
                  :title="$t('history.exportAll')"
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <Download class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{{ $t('history.exportAll') }}</span>
                  <ChevronDown class="w-3 h-3 text-slate-400 -mr-0.5" />
                </button>

                <!-- Dropdown Menu -->
                <div
                  v-if="showExportAllMenu"
                  class="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-fade-in text-xs select-none"
                >
                  <button
                    type="button"
                    @click.stop="handleExportAllCsv"
                    class="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors text-left cursor-pointer"
                  >
                    <FileSpreadsheet class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{{ $t('history.csvFormat') }}</span>
                  </button>
                  <button
                    type="button"
                    @click.stop="handleExportAllJson"
                    class="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors text-left cursor-pointer"
                  >
                    <FileCode class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{{ $t('history.jsonFormat') }}</span>
                  </button>
                </div>
              </div>

              <!-- Clear All History Button -->
              <button
                type="button"
                @click="handleClearAllHistory"
                :title="$t('history.clearAll')"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-xs font-medium text-red-600 dark:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">{{ $t('history.clearAll') }}</span>
              </button>

              <span class="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5"></span>
            </template>

            <!-- Maximize / Restore Toggle Button -->
            <button
              type="button"
              @click="isMaximized = !isMaximized"
              :title="isMaximized ? $t('history.restore') : $t('history.maximize')"
              class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <Minimize2 v-if="isMaximized" class="w-4 h-4" />
              <Maximize2 v-else class="w-4 h-4" />
            </button>

            <!-- Close Button -->
            <button
              type="button"
              @click="close"
              class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </header>

        <!-- Modal Body (Empty State or Master-Detail) -->
        <div class="flex-1 flex overflow-hidden min-h-0">
          <!-- Empty State -->
          <div
            v-if="historyStore.batches.length === 0"
            class="flex-1 flex flex-col items-center justify-center p-8 text-center"
          >
            <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4 shadow-inner">
              <History class="w-8 h-8" />
            </div>
            <h3 class="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1.5">{{ $t('history.empty') }}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">{{ $t('history.emptyDesc') }}</p>
          </div>

          <!-- Master-Detail Content -->
          <div v-else class="flex-1 flex overflow-hidden min-h-0 divide-x divide-slate-200 dark:divide-slate-800">
            <!-- Left Sidebar: Batches Timeline List -->
            <div class="w-72 sm:w-80 flex flex-col shrink-0 bg-slate-50/60 dark:bg-slate-900/40 overflow-hidden">
              <div class="p-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{{ $t('history.batches') }}</span>
                <span>{{ historyStore.batches.length }}</span>
              </div>

              <div class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                <button
                  v-for="batch in historyStore.batches"
                  :key="batch.id"
                  type="button"
                  @click="selectedBatchId = batch.id"
                  :class="[
                    'w-full text-left p-3 rounded-xl transition-all border cursor-pointer select-none',
                    selectedBatchId === batch.id
                      ? 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700/80 shadow-xs'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                  ]"
                >
                  <div class="flex items-center justify-between gap-1.5 mb-1.5">
                    <span
                      class="px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                      :class="{
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300': batch.action === 'rename',
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300': batch.action === 'copy',
                        'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300': batch.action === 'undo'
                      }"
                    >
                      {{
                        batch.action === 'rename'
                          ? $t('history.actionRename')
                          : batch.action === 'copy'
                          ? $t('history.actionCopy')
                          : $t('history.actionUndo')
                      }}
                    </span>
                    <span class="text-[11px] text-slate-400 font-mono">
                      {{ formatDate(batch.timestamp).split(' ')[1] }}
                    </span>
                  </div>

                  <div class="text-[11px] text-slate-600 dark:text-slate-400 font-mono mb-2">
                    {{ formatDate(batch.timestamp).split(' ')[0] }}
                  </div>

                  <!-- Count & Status chips -->
                  <div class="flex items-center gap-1.5 text-[10.5px]">
                    <span class="text-slate-600 dark:text-slate-300 font-medium">
                      {{ $t('history.fileCount', { n: batch.totalFiles }) }}
                    </span>
                    <span class="text-slate-300 dark:text-slate-600">•</span>
                    <span class="text-emerald-600 dark:text-emerald-400">
                      {{ $t('history.successCount', { n: batch.successCount }) }}
                    </span>
                    <template v-if="batch.failedCount > 0 || batch.conflictCount > 0">
                      <span class="text-slate-300 dark:text-slate-600">•</span>
                      <span class="text-red-500 font-semibold">
                        {{ $t('history.failedCount', { n: batch.failedCount + batch.conflictCount }) }}
                      </span>
                    </template>
                  </div>
                </button>
              </div>
            </div>

            <!-- Right Detail Panel -->
            <div v-if="selectedBatch" class="flex-1 flex flex-col overflow-hidden min-w-0 bg-white dark:bg-slate-900">
              <!-- Top Summary Banner (當前聚焦批次操作) -->
              <div class="relative z-20 p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 shrink-0 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {{ formatDate(selectedBatch.timestamp) }}
                      </h3>
                      <button
                        type="button"
                        @click="handleCopyBatchId(selectedBatch.id)"
                        class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 p-0.5 rounded cursor-pointer"
                        :title="`ID: ${selectedBatch.id}`"
                      >
                        <Check v-if="copiedBatchId" class="w-3 h-3 text-emerald-500" />
                        <Copy v-else class="w-3 h-3" />
                      </button>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Batch ID: <span class="font-mono text-[11px]">{{ selectedBatch.id.slice(0, 8) }}...</span>
                    </p>
                  </div>

                  <!-- Actions for Current Active Batch -->
                  <div class="flex flex-wrap items-center gap-2">
                    <!-- Reapply Rules Button -->
                    <button
                      v-if="selectedBatch.rulesSnapshot && selectedBatch.rulesSnapshot.length > 0"
                      type="button"
                      @click="handleReapplyRules(selectedBatch)"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      <Layers class="w-3.5 h-3.5" />
                      <span>{{ $t('history.reapplyRules') }} ({{ selectedBatch.rulesSnapshot.length }})</span>
                    </button>

                    <!-- Export Current Batch Dropdown Button -->
                    <div class="relative">
                      <button
                        type="button"
                        @click.stop="showBatchExportMenu = !showBatchExportMenu"
                        :title="$t('history.exportBatch')"
                        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Download class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        <span>{{ $t('history.exportBatch') }}</span>
                        <ChevronDown class="w-3 h-3 text-slate-400 -mr-0.5" />
                      </button>

                      <!-- Batch Export Dropdown Menu -->
                      <div
                        v-if="showBatchExportMenu"
                        class="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-fade-in text-xs select-none"
                      >
                        <button
                          type="button"
                          @click.stop="handleExportBatchCsv(selectedBatch)"
                          class="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors text-left cursor-pointer"
                        >
                          <FileSpreadsheet class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{{ $t('history.csvFormat') }}</span>
                        </button>
                        <button
                          type="button"
                          @click.stop="handleExportBatchJson(selectedBatch)"
                          class="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors text-left cursor-pointer"
                        >
                          <FileCode class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span>{{ $t('history.jsonFormat') }}</span>
                        </button>
                      </div>
                    </div>

                    <!-- Delete Current Batch -->
                    <button
                      type="button"
                      @click="handleDeleteBatch(selectedBatch.id)"
                      :title="$t('history.deleteBatch')"
                      class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/50 text-xs font-medium text-red-600 dark:text-red-400 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                      <span>{{ $t('history.deleteBatch') }}</span>
                    </button>
                  </div>
                </div>

                <!-- Rules Snapshot Accordion -->
                <div v-if="selectedBatch.rulesSnapshot && selectedBatch.rulesSnapshot.length > 0" class="border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-white dark:bg-slate-950/60 text-xs">
                  <button
                    type="button"
                    @click="showRulesSnapshot = !showRulesSnapshot"
                    class="w-full flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                  >
                    <span class="flex items-center gap-1.5">
                      <Layers class="w-3.5 h-3.5 text-blue-500" />
                      {{ $t('history.rulesUsed') }} ({{ selectedBatch.rulesSnapshot.length }})
                    </span>
                    <span class="text-slate-400 text-[11px]">{{ showRulesSnapshot ? '▲ 收合' : '▼ 展開' }}</span>
                  </button>

                  <div v-if="showRulesSnapshot" class="mt-2 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div
                      v-for="(rule, idx) in selectedBatch.rulesSnapshot"
                      :key="idx"
                      class="flex items-center gap-2 p-1.5 rounded bg-slate-50 dark:bg-slate-900 font-mono text-[11px]"
                    >
                      <span class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold text-[10px]">
                        #{{ idx + 1 }} {{ rule.type }}
                      </span>
                      <span class="text-slate-600 dark:text-slate-400 truncate">
                        {{ JSON.stringify(rule.params) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Search and Filter Toolbar -->
              <div class="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <!-- Search Box -->
                <div class="relative flex-1 max-w-xs">
                  <Search class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    v-model="searchQuery"
                    type="text"
                    :placeholder="$t('history.searchPlaceholder')"
                    class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    v-if="searchQuery"
                    @click="searchQuery = ''"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>

                <!-- Status Filter Pills -->
                <div class="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs">
                  <button
                    type="button"
                    @click="statusFilter = 'all'"
                    :class="[
                      'px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium',
                      statusFilter === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    ]"
                  >
                    {{ $t('history.filterAll') }} ({{ selectedBatch.files.length }})
                  </button>
                  <button
                    type="button"
                    @click="statusFilter = 'success'"
                    :class="[
                      'px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium',
                      statusFilter === 'success'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    ]"
                  >
                    {{ $t('history.filterSuccess') }} ({{ selectedBatch.successCount }})
                  </button>
                  <button
                    type="button"
                    @click="statusFilter = 'failed'"
                    :class="[
                      'px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium',
                      statusFilter === 'failed'
                        ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    ]"
                  >
                    {{ $t('history.filterFailed') }} ({{ selectedBatch.failedCount + selectedBatch.conflictCount }})
                  </button>
                </div>
              </div>

              <!-- Padded Table Container with Internal Scroll -->
              <div class="p-3.5 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div class="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/30 dark:bg-slate-900/30 flex flex-col min-h-0 shadow-2xs">
                  <div class="flex-1 overflow-auto custom-scrollbar">
                    <table class="w-full text-left text-xs border-collapse">
                      <thead class="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 select-none">
                        <tr>
                          <th class="py-2.5 px-3.5 w-12 text-center">{{ $t('history.status') }}</th>
                          <th class="py-2.5 px-3.5 w-5/12">
                            <span>{{ $t('history.originalName') }}</span>
                            <ArrowRight class="w-3 h-3 inline mx-1.5 text-slate-400 -mt-0.5" />
                            <span>{{ $t('history.newName') }}</span>
                          </th>
                          <th class="py-2.5 px-3.5 w-6/12">
                            <span>{{ selectedBatch.action === 'copy' ? $t('history.targetPath') : $t('history.path') }} / {{ $t('history.error') }}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono bg-white dark:bg-slate-900/60">
                        <tr
                          v-for="file in filteredFiles"
                          :key="file.id"
                          class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <!-- Status Icon -->
                          <td class="py-3 px-3.5 align-top text-center">
                            <CheckCircle2
                              v-if="file.status === 'success'"
                              class="w-4 h-4 text-emerald-500 inline"
                              title="Success"
                            />
                            <RotateCcw
                              v-else-if="file.status === 'undone'"
                              class="w-4 h-4 text-blue-500 inline"
                              title="Undone"
                            />
                            <AlertTriangle
                              v-else-if="file.status === 'conflict'"
                              class="w-4 h-4 text-amber-500 inline"
                              title="Conflict"
                            />
                            <XCircle
                              v-else
                              class="w-4 h-4 text-red-500 inline"
                              title="Failed"
                            />
                          </td>

                          <!-- Name Diff -->
                          <td class="py-3 px-3.5 align-top">
                            <div class="space-y-1 font-sans">
                              <div class="text-slate-500 dark:text-slate-400 line-through text-[11.5px] truncate" :title="file.originalName">
                                {{ file.originalName }}
                              </div>
                              <div class="text-slate-900 dark:text-slate-100 font-semibold text-xs flex items-center gap-1.5 truncate" :title="file.newName">
                                <ArrowRight class="w-3 h-3 text-blue-500 shrink-0 inline" />
                                <span :class="file.status === 'success' ? 'text-emerald-700 dark:text-emerald-300' : ''">
                                  {{ file.newName }}
                                </span>
                              </div>
                            </div>
                          </td>

                          <!-- Path and Error Details -->
                          <td class="py-3 px-3.5 align-top">
                            <div class="space-y-1.5">
                              <!-- When it is a Copy operation -->
                              <template v-if="selectedBatch.action === 'copy'">
                                <div class="text-slate-500 dark:text-slate-400 text-[10.5px] truncate flex items-center gap-1.5" :title="file.oldPath">
                                  <span class="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-sans shrink-0 font-medium">
                                    {{ $t('history.sourceLabel') }}
                                  </span>
                                  <span class="truncate">{{ file.oldPath }}</span>
                                </div>
                                <div class="text-slate-700 dark:text-slate-300 text-[10.5px] font-medium truncate flex items-center gap-1.5" :title="file.newPath">
                                  <span class="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-sans shrink-0 font-medium flex items-center gap-0.5">
                                    <FolderSymlink class="w-2.5 h-2.5 inline" />
                                    {{ $t('history.targetLabel') }}
                                  </span>
                                  <span class="truncate text-emerald-800 dark:text-emerald-300">{{ file.newPath }}</span>
                                </div>
                              </template>

                              <!-- Standard Rename operation -->
                              <template v-else>
                                <div class="text-slate-500 dark:text-slate-400 text-[11px] truncate" :title="file.newPath || file.oldPath">
                                  {{ file.newPath || file.oldPath }}
                                </div>
                              </template>

                              <!-- Error details if failed or conflict -->
                              <div
                                v-if="file.error"
                                class="text-[11px] text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 px-2 py-0.5 rounded inline-block"
                              >
                                {{ file.error }}
                              </div>
                            </div>
                          </td>
                        </tr>

                        <tr v-if="filteredFiles.length === 0">
                          <td colspan="3" class="py-12 text-center text-slate-400 font-sans">
                            沒有符合條件的檔案紀錄
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
