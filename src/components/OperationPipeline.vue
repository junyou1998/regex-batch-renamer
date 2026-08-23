<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick, computed } from 'vue'
import { useOperationStore, type Operation } from '../stores/operationStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from 'vue-i18n'
import HelpModal from './HelpModal.vue'
import PresetManager from './PresetManager.vue'
import { savePreset, loadPresets, type Preset } from '../services/presetService'
import { useToastStore } from '../stores/toastStore'
import { usePluginStore, type InstalledPlugin } from '../stores/pluginStore'
import { runPluginHealthCheck } from '../services/pluginRunner'
import PluginModal from './PluginModal.vue'
import CustomSelect from './CustomSelect.vue'
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  HelpCircle,
  Pencil,
  Plus,
  Save,
  Settings,
  Undo2,
  X,
  Zap,
  Sparkles,
  Puzzle,
  AlertCircle,
  LoaderCircle
} from 'lucide-vue-next'

defineProps<{
  canUndo?: boolean
}>()

const emit = defineEmits<{
  (e: 'undo'): void
}>()

const { t } = useI18n()
const operationStore = useOperationStore()
const settingsStore = useSettingsStore()
const toastStore = useToastStore()
const showHelp = ref(false)

const pluginStore = usePluginStore()
const showPluginModal = ref(false)
const showAddDropdown = ref(false)
const addDropdownContainerRef = ref<HTMLElement | null>(null)
const openDropdownOpId = ref<string | null>(null)

async function checkHealth(pluginId?: string) {
  if (!pluginId) return
  await runPluginHealthCheck(pluginId)
}

// Automatically perform health check for newly added network plugins
watch(
  () => operationStore.operations,
  (ops) => {
    ops.forEach(op => {
      if (op.type === 'plugin' && op.params?.pluginId) {
        const plugin = pluginStore.getPlugin(op.params.pluginId)
        if (plugin?.manifest.permissions?.includes('network')) {
          const currentHealth = pluginStore.getPluginHealth(op.params.pluginId)
          if (currentHealth.status === 'unknown') {
            runPluginHealthCheck(op.params.pluginId)
          }
        }
      }
    })
  },
  { immediate: true, deep: true }
)

function addPluginOperation(plugin: InstalledPlugin) {
  showAddDropdown.value = false
  const defaultParams: Record<string, any> = {
    pluginId: plugin.manifest.id
  }
  if (plugin.manifest.options) {
    plugin.manifest.options.forEach(opt => {
      defaultParams[opt.key] = opt.default !== undefined ? opt.default : ''
    })
  }
  operationStore.addOperation('plugin', defaultParams)
  scrollToBottom()
  if (plugin.manifest.permissions?.includes('network')) {
    runPluginHealthCheck(plugin.manifest.id)
  }
}

const operationsModel = computed({
  get: () => operationStore.operations,
  set: (val: Operation[]) => {
    operationStore.operations = val
  }
})

const activeOperationDragId = ref<string | null>(null)
const operationDropTargetId = ref<string | null>(null)
const operationDropPosition = ref<'before' | 'after' | null>(null)
const operationDragPreview = ref({ visible: false, x: 0, y: 0 })
const draggedOperation = computed(() => operationStore.operations.find(op => op.id === activeOperationDragId.value))

const OPERATION_AUTO_SCROLL_EDGE_THRESHOLD = 40
const OPERATION_AUTO_SCROLL_STEP = 16
const OPERATION_AUTO_SCROLL_INTERVAL = 16

const operationAutoScrollDirection = ref<-1 | 1 | 0>(0)
let operationAutoScrollTimer: ReturnType<typeof setInterval> | null = null
let lastOperationPointer: { x: number; y: number } | null = null

function getOperationIndexById(id: string) {
  return operationStore.operations.findIndex(op => op.id === id)
}

function getOperationScrollContainer() {
  if (operationsList.value) return operationsList.value
  return null
}

function stopOperationAutoScroll() {
  operationAutoScrollDirection.value = 0
  if (operationAutoScrollTimer) {
    clearInterval(operationAutoScrollTimer)
    operationAutoScrollTimer = null
  }
}

function startOperationAutoScroll(direction: -1 | 1) {
  if (operationAutoScrollDirection.value === direction && operationAutoScrollTimer) return

  stopOperationAutoScroll()
  operationAutoScrollDirection.value = direction
  operationAutoScrollTimer = setInterval(() => {
    const container = getOperationScrollContainer()
    if (!container || !activeOperationDragId.value) {
      stopOperationAutoScroll()
      return
    }

    container.scrollTop += OPERATION_AUTO_SCROLL_STEP * direction
    if (lastOperationPointer) {
      updateOperationDropTarget(lastOperationPointer.x, lastOperationPointer.y)
    }
  }, OPERATION_AUTO_SCROLL_INTERVAL)
}

function handleOperationAutoScroll(clientY: number) {
  const container = getOperationScrollContainer()
  if (!container || !activeOperationDragId.value) return

  const { top, bottom } = container.getBoundingClientRect()
  if (clientY <= top + OPERATION_AUTO_SCROLL_EDGE_THRESHOLD) {
    startOperationAutoScroll(-1)
    return
  }

  if (clientY >= bottom - OPERATION_AUTO_SCROLL_EDGE_THRESHOLD) {
    startOperationAutoScroll(1)
    return
  }

  stopOperationAutoScroll()
}

function getOperationDropTarget(clientX: number, clientY: number) {
  const container = operationsList.value
  if (!container) return null

  const hit = document.elementFromPoint(clientX, clientY)
  const card = hit instanceof HTMLElement
    ? hit.closest<HTMLElement>('[data-operation-id]')
    : null

  if (card && container.contains(card)) {
    const id = card.dataset.operationId
    if (!id || id === activeOperationDragId.value) return null
    const rect = card.getBoundingClientRect()
    return {
      id,
      position: clientY < rect.top + rect.height / 2 ? 'before' as const : 'after' as const,
    }
  }

  const visibleCards = Array.from(container.querySelectorAll<HTMLElement>('[data-operation-id]'))
    .filter(cardEl => cardEl.dataset.operationId !== activeOperationDragId.value)

  const first = visibleCards.at(0)
  const last = visibleCards.at(-1)
  if (first && clientY < first.getBoundingClientRect().top) {
    return { id: first.dataset.operationId || '', position: 'before' as const }
  }
  if (last && clientY > last.getBoundingClientRect().bottom) {
    return { id: last.dataset.operationId || '', position: 'after' as const }
  }

  return null
}

function updateOperationDropTarget(clientX: number, clientY: number) {
  const target = getOperationDropTarget(clientX, clientY)
  operationDropTargetId.value = target?.id || null
  operationDropPosition.value = target?.position || null
}

function startOperationReorder(event: PointerEvent, operationId: string) {
  if (event.button !== 0) return
  event.preventDefault()
  activeOperationDragId.value = operationId
  lastOperationPointer = { x: event.clientX, y: event.clientY }
  operationDragPreview.value = { visible: true, x: event.clientX, y: event.clientY }
  updateOperationDropTarget(event.clientX, event.clientY)
  window.addEventListener('pointermove', onOperationPointerMove)
  window.addEventListener('pointerup', onOperationPointerUp)
  window.addEventListener('pointercancel', cancelOperationReorder)
}

function onOperationPointerMove(event: PointerEvent) {
  if (!activeOperationDragId.value) return
  event.preventDefault()
  lastOperationPointer = { x: event.clientX, y: event.clientY }
  operationDragPreview.value = { visible: true, x: event.clientX, y: event.clientY }
  handleOperationAutoScroll(event.clientY)
  updateOperationDropTarget(event.clientX, event.clientY)
}

function onOperationPointerUp() {
  if (activeOperationDragId.value && operationDropTargetId.value && operationDropPosition.value) {
    const fromIndex = getOperationIndexById(activeOperationDragId.value)
    const targetIndex = getOperationIndexById(operationDropTargetId.value)
    if (fromIndex !== -1 && targetIndex !== -1) {
      const nextOperations = [...operationStore.operations]
      const [movedOperation] = nextOperations.splice(fromIndex, 1)
      if (movedOperation) {
        let insertIndex = targetIndex + (operationDropPosition.value === 'after' ? 1 : 0)
        if (fromIndex < insertIndex) {
          insertIndex -= 1
        }
        insertIndex = Math.max(0, Math.min(nextOperations.length, insertIndex))
        nextOperations.splice(insertIndex, 0, movedOperation)
        operationStore.operations = nextOperations
      }
    }
  }
  cancelOperationReorder()
}

function cancelOperationReorder() {
  activeOperationDragId.value = null
  operationDropTargetId.value = null
  operationDropPosition.value = null
  operationDragPreview.value = { visible: false, x: 0, y: 0 }
  lastOperationPointer = null
  stopOperationAutoScroll()
  window.removeEventListener('pointermove', onOperationPointerMove)
  window.removeEventListener('pointerup', onOperationPointerUp)
  window.removeEventListener('pointercancel', cancelOperationReorder)
}

// Badge logic
interface Badge {
  type: string
  label: string
  color: string
  isLiteral?: boolean
}

function getBadges(op: any): Badge[] {
  const badges: Badge[] = []
  if (op.type === 'plugin') {
    badges.push({
      type: 'mode-plugin',
      label: '外掛',
      color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60',
      isLiteral: true
    })
    return badges
  }

  if (op.type !== 'regex') return badges

  // 1. Type badge (Regex vs Text) always first
  if (op.params?.useRegex) {
    badges.push({
      type: 'mode-regex',
      label: 'Regex',
      color: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60',
      isLiteral: true
    })
  } else {
    badges.push({
      type: 'mode-text',
      label: 'Text',
      color: 'bg-slate-200/80 dark:bg-slate-700/60 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-600/60',
      isLiteral: true
    })
  }

  const pattern = op.params?.pattern || ''
  const replacement = op.params?.replacement || ''

  // 2. Feature badges: Prefix, Suffix, Sequence
  // Prefix detection: Pattern is exactly '^'
  if (pattern === '^') {
    badges.push({ type: 'prefix', label: 'badges.prefix', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50' })
  }

  // Suffix detection: Pattern is exactly '$'
  if (pattern === '$') {
    badges.push({ type: 'suffix', label: 'badges.suffix', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50' })
  }

  // Sequence detection: Replacement contains strictly valid ${n...}
  if (/\$\{n(?::\d+(?::\d+)?)?\}/.test(replacement)) {
    badges.push({ type: 'sequence', label: 'badges.sequence', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50' })
  }

  return badges
}


onMounted(() => {
  // ... existing onMounted code ...
  const hasSeenHelp = localStorage.getItem('has-seen-help')
  if (!hasSeenHelp) {
    showHelp.value = true
  }
})

watch(showHelp, (newValue) => {
  if (!newValue) {
    localStorage.setItem('has-seen-help', 'true')
  }
})

const operationsList = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (operationsList.value && operationsList.value.lastElementChild) {
      operationsList.value.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

function addRegexOperation() {
  showAddDropdown.value = false
  operationStore.addOperation('regex', { pattern: '', replacement: '', useRegex: settingsStore.defaultUseRegex })
  scrollToBottom()
}

const activeHelperId = ref<string | null>(null)
const helperWidth = ref(1)
const helperStart = ref(1)
const inputRefs = ref<Record<string, HTMLInputElement>>({})

const helperPreviewList = computed(() => {
  const width = Math.max(1, typeof helperWidth.value === 'number' ? helperWidth.value : 1)
  const start = typeof helperStart.value === 'number' ? helperStart.value : 1
  const examples = [start, start + 1, start + 2].map(n => n.toString().padStart(width, '0'))
  return `${examples.join(', ')}...`
})

function setInputRef(el: any, id: string) {
  if (el) inputRefs.value[id] = el
}

function openHelper(id: string) {
  activeHelperId.value = id
  helperWidth.value = 1
  helperStart.value = 1
}

function closeHelper() {
  activeHelperId.value = null
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && activeHelperId.value) {
    closeHelper()
  }
  if (e.key === 'Escape' && showTemplateDropdown.value) {
    showTemplateDropdown.value = false
  }
  if (e.key === 'Escape' && showPrefixSuffixModal.value) {
    closePrefixSuffixModal()
  }
  if (e.key === 'Escape' && showSavePresetModal.value) {
    closeSavePresetModal()
  }
}

function insertVariable() {
  if (!activeHelperId.value) return

  const op = operationStore.operations.find(o => o.id === activeHelperId.value)
  if (!op) return

  const width = Math.max(1, typeof helperWidth.value === 'number' ? helperWidth.value : 1)
  const start = typeof helperStart.value === 'number' ? helperStart.value : 1

  let varStr = '${n'
  if (width > 1 || start !== 1) {
    varStr += `:${width}`
    if (start !== 1) {
      varStr += `:${start}`
    }
  }
  varStr += '}'

  const inputEl = inputRefs.value[op.id]
  if (inputEl) {
    const startPos = inputEl.selectionStart || 0
    const endPos = inputEl.selectionEnd || 0
    const text = op.params.replacement || ''
    op.params.replacement = text.substring(0, startPos) + varStr + text.substring(endPos)
  } else {
    op.params.replacement = (op.params.replacement || '') + varStr
  }

  closeHelper()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  cancelOperationReorder()
})

const showTemplateDropdown = ref(false)
const showPrefixSuffixModal = ref(false)
const prefixSuffixMode = ref<'prefix' | 'suffix'>('prefix')
const prefixSuffixValue = ref('')
const showPresetManager = ref(false)
const showSavePresetModal = ref(false)
const savePresetName = ref('')
const savedTemplates = ref<Preset[]>([])
const templateContainerRef = ref<HTMLElement | null>(null)

function handleDocumentClick(e: MouseEvent | PointerEvent) {
  const target = e.target as Node | null
  if (showTemplateDropdown.value && templateContainerRef.value && target && !templateContainerRef.value.contains(target)) {
    showTemplateDropdown.value = false
  }
  if (showAddDropdown.value && addDropdownContainerRef.value && target && !addDropdownContainerRef.value.contains(target)) {
    showAddDropdown.value = false
  }
}

watch([showTemplateDropdown, showAddDropdown], ([isTplOpen, isAddOpen]) => {
  if (isTplOpen || isAddOpen) {
    nextTick(() => {
      window.addEventListener('pointerdown', handleDocumentClick)
    })
  } else {
    window.removeEventListener('pointerdown', handleDocumentClick)
  }
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', handleDocumentClick)
})

function refreshSavedTemplates() {
  savedTemplates.value = loadPresets()
}

function handleSaveTemplate() {
  showTemplateDropdown.value = false
  if (operationStore.operations.length === 0) return
  savePresetName.value = ''
  showSavePresetModal.value = true
}

function confirmSavePreset() {
  const name = savePresetName.value.trim()
  if (!name) return
  const snapshot = operationStore.getSnapshot()
  savePreset(name, snapshot.map(op => ({ ...op, enabled: true })))
  toastStore.addToast(t('templates.saveSuccess', { name }), 'success')
  closeSavePresetModal()
}

function closeSavePresetModal() {
  showSavePresetModal.value = false
  savePresetName.value = ''
}

function loadSavedTemplate(preset: Preset) {
  showTemplateDropdown.value = false
  operationStore.loadFromPreset(preset.operations)
  toastStore.addToast(t('templates.loadSuccess', { name: preset.name }), 'success')
}

function handlePresetLoaded(name: string) {
  toastStore.addToast(t('templates.loadSuccess', { name }), 'success')
}

function openManageTemplates() {
  showTemplateDropdown.value = false
  showPresetManager.value = true
}

function toggleTemplateDropdown() {
  if (!showTemplateDropdown.value) {
    refreshSavedTemplates()
  }
  showTemplateDropdown.value = !showTemplateDropdown.value
}

function applyTemplate(templateId: string) {
  showTemplateDropdown.value = false

  switch (templateId) {
    case 'replaceAllNumbered':
      operationStore.addOperation('regex', {
        pattern: '^.*',
        replacement: '${n:2}',
        useRegex: true
      })
      scrollToBottom()
      break
    case 'removeSpaces':
      operationStore.addOperation('regex', {
        pattern: '\\s+',
        replacement: '',
        useRegex: true
      })
      scrollToBottom()
      break
    case 'spacesToUnderscore':
      operationStore.addOperation('regex', {
        pattern: '\\s+',
        replacement: '_',
        useRegex: true
      })
      scrollToBottom()
      break
    case 'addPrefix':
      prefixSuffixMode.value = 'prefix'
      prefixSuffixValue.value = ''
      showPrefixSuffixModal.value = true
      break
    case 'addSuffix':
      prefixSuffixMode.value = 'suffix'
      prefixSuffixValue.value = ''
      showPrefixSuffixModal.value = true
      break
  }
}

function closePrefixSuffixModal() {
  showPrefixSuffixModal.value = false
  prefixSuffixValue.value = ''
}

function confirmPrefixSuffix() {
  // ... existing prefix/suffix logic ...
  if (!prefixSuffixValue.value.trim()) {
    closePrefixSuffixModal()
    return
  }

  if (prefixSuffixMode.value === 'prefix') {
    operationStore.addOperation('regex', {
      pattern: '^',
      replacement: prefixSuffixValue.value,
      useRegex: true
    })
  } else {
    operationStore.addOperation('regex', {
      pattern: '$',
      replacement: prefixSuffixValue.value,
      useRegex: true
    })
  }

  closePrefixSuffixModal()
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <!-- Fixed Pipeline Header with Stacking Context -->
    <div
      class="relative z-30 flex items-center justify-between flex-wrap gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md shrink-0 shadow-2xs">
      <h2 class="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
        <span class="w-1 h-4 bg-blue-500 rounded-full"></span>
        {{ $t('operations.title') }}

        <button type="button" @click="showHelp = true"
          class="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
          title="使用說明與 Regex 教學">
          <HelpCircle class="h-4 w-4" />
        </button>

        <button type="button" v-if="canUndo" @click="emit('undo')"
          class="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer ml-1"
          :title="$t('app.undo')">
          <Undo2 class="h-4 w-4" />
        </button>
      </h2>
      <div class="flex items-center gap-2">
        <!-- Templates Dropdown (built-in + custom) -->
        <div ref="templateContainerRef" class="relative template-dropdown-container">
          <button type="button" @click="toggleTemplateDropdown"
            class="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
            <Zap class="h-3.5 w-3.5" />
            {{ $t('operations.quickTemplates') }}
            <ChevronDown class="h-3 w-3 ml-0.5" />
          </button>

          <!-- Local Absolute Dropdown Menu -->
          <Transition name="dropdown">
            <div v-if="showTemplateDropdown"
              class="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 overflow-y-auto max-h-80 custom-scrollbar">

              <!-- Built-in Templates Section -->
              <div
                class="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {{ $t('templates.sectionBuiltIn') }}
              </div>
              <button @click="applyTemplate('replaceAllNumbered')"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                {{ $t('operations.template.replaceAllNumbered') }}
              </button>
              <button @click="applyTemplate('removeSpaces')"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                {{ $t('operations.template.removeSpaces') }}
              </button>
              <button @click="applyTemplate('spacesToUnderscore')"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                {{ $t('operations.template.spacesToUnderscore') }}
              </button>
              <button @click="applyTemplate('addPrefix')"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                {{ $t('operations.template.addPrefix') }}
              </button>
              <button @click="applyTemplate('addSuffix')"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                {{ $t('operations.template.addSuffix') }}
              </button>

              <!-- Custom Templates Section -->
              <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>
              <div
                class="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {{ $t('templates.sectionCustom') }}
              </div>
              <template v-if="savedTemplates.length > 0">
                <button v-for="tpl in savedTemplates" :key="tpl.id" @click="loadSavedTemplate(tpl)"
                  class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center justify-between gap-2">
                  <span class="flex items-center gap-1.5 truncate">
                    <FileText class="h-3.5 w-3.5 shrink-0" />
                    <span class="truncate">{{ tpl.name }}</span>
                  </span>
                  <span class="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">{{ $t('templates.ops', {
                    n: tpl.operations.length
                  }) }}</span>
                </button>
              </template>
              <div v-else class="px-4 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                {{ $t('templates.empty') }}
              </div>

              <!-- Actions Section -->
              <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>
              <button @click="handleSaveTemplate" :disabled="operationStore.operations.length === 0"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                <Save class="h-3.5 w-3.5" /> {{ $t('templates.saveCurrent') }}
              </button>
              <button @click="openManageTemplates"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5">
                <Settings class="h-3.5 w-3.5" /> {{ $t('templates.manageTemplates') }}
              </button>
            </div>
          </Transition>
        </div>

        <!-- Add Operation Button & Dropdown -->
        <div ref="addDropdownContainerRef" class="relative">
          <button
            type="button"
            @click="showAddDropdown = !showAddDropdown"
            class="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus class="h-3.5 w-3.5" />
            <span>{{ $t('operations.add') }}</span>
            <ChevronDown class="h-3 w-3 ml-0.5" />
          </button>

          <!-- Add Dropdown Menu -->
          <Transition name="dropdown">
            <div
              v-if="showAddDropdown"
              class="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 overflow-y-auto max-h-80 custom-scrollbar text-xs select-none"
            >
              <button
                type="button"
                @click="addRegexOperation"
                class="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-2 font-medium"
              >
                <Sparkles class="w-3.5 h-3.5 text-blue-500" />
                <span>{{ $t('operations.regexRule') }}</span>
              </button>

              <!-- Enabled Plugin Rules -->
              <template v-if="pluginStore.enabledTransformerPlugins.length > 0">
                <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>
                <div class="px-3 py-1 text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Puzzle class="w-3 h-3 text-purple-500" />
                  <span>{{ $t('plugins.title') }}</span>
                </div>

                <button
                  v-for="plugin in pluginStore.enabledTransformerPlugins"
                  :key="plugin.manifest.id"
                  type="button"
                  @click="addPluginOperation(plugin)"
                  class="w-full px-3.5 py-2 text-left text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 dark:hover:text-purple-300 transition-colors cursor-pointer flex items-center justify-between gap-1.5"
                >
                  <span class="truncate">{{ plugin.manifest.name }}</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-mono shrink-0">外掛</span>
                </button>
              </template>

              <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>
              <button
                type="button"
                @click="showAddDropdown = false; showPluginModal = true"
                class="w-full px-3.5 py-2 text-left text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-2"
              >
                <Puzzle class="w-3.5 h-3.5 text-purple-500" />
                <span>{{ $t('plugins.manage') }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Scrollable Operations List Area -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 min-h-0" ref="operationsList">
      <div class="space-y-3">
        <div v-for="(op, index) in operationsModel" :key="op.id" :data-operation-id="op.id"
          class="relative bg-slate-200/50 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-300 dark:border-slate-700 rounded-xl p-4 shadow-2xs transition-colors hover:border-slate-400 dark:hover:border-slate-600 group"
          :style="{ zIndex: activeOperationDragId === op.id ? 1000 : (openDropdownOpId === op.id ? 100 : (operationsModel.length - index + 5)) }"
          :class="{
            'opacity-50 grayscale': !op.enabled,
            'ring-2 ring-blue-400/50 bg-blue-50 dark:bg-blue-950/30': activeOperationDragId === op.id,
            '!border-t-4 !border-t-blue-500 dark:!border-t-blue-400': operationDropTargetId === op.id && operationDropPosition === 'before',
            '!border-b-4 !border-b-blue-500 dark:!border-b-blue-400': operationDropTargetId === op.id && operationDropPosition === 'after'
          }">
          <div class="flex items-center justify-between mb-2.5 select-none group/header">
            <div class="flex items-center gap-2 min-w-0">
              <button type="button"
                class="drag-handle inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-300/70 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing"
                @pointerdown.stop="startOperationReorder($event, op.id)"
                :title="$t('operations.reorder')">
                <GripVertical class="h-4 w-4" />
              </button>
              <span class="text-xs font-bold text-slate-500 dark:text-slate-500 shrink-0">#{{ index + 1 }}</span>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                {{
                  op.type === 'regex'
                    ? $t('operations.regex')
                    : op.type === 'plugin'
                    ? (pluginStore.getPlugin(op.params.pluginId)?.manifest.name || $t('plugins.unknownPlugin'))
                    : $t('operations.other')
                }}
              </span>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button @click="operationStore.toggleOperation(op.id)"
                class="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer mr-2"
                :title="$t('operations.toggleEnable')">
                <Eye v-if="op.enabled" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </button>
              <button @click="operationStore.removeOperation(op.id)"
                class="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-900/30 ml-1 cursor-pointer"
                :title="$t('operations.remove')">
                <X class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Smart Badges (Type badge first, then features) -->
          <div v-if="getBadges(op).length" class="flex flex-wrap items-center gap-1.5 mb-3">
            <span v-for="badge in getBadges(op)" :key="badge.type"
              class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md" :class="badge.color">
              {{ badge.isLiteral ? badge.label : $t(badge.label) }}
            </span>
            <!-- Plugin Health Status Badge with Click to Check -->
            <button
              v-if="op.type === 'plugin' && pluginStore.getPlugin(op.params?.pluginId)?.manifest.permissions?.includes('network')"
              type="button"
              @click.stop="checkHealth(op.params?.pluginId)"
              class="text-[10px] font-medium px-1.5 py-0.5 rounded-md border flex items-center gap-1 transition-colors cursor-pointer"
              :class="{
                'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60': pluginStore.getPluginHealth(op.params?.pluginId).status === 'healthy',
                'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60 hover:bg-red-100 dark:hover:bg-red-900/60': pluginStore.getPluginHealth(op.params?.pluginId).status === 'unhealthy',
                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700': pluginStore.getPluginHealth(op.params?.pluginId).status === 'unknown' || pluginStore.getPluginHealth(op.params?.pluginId).status === 'checking'
              }"
              :title="pluginStore.getPluginHealth(op.params?.pluginId).message || '點擊檢測健康度'"
            >
              <span
                v-if="pluginStore.getPluginHealth(op.params?.pluginId).status === 'healthy'"
                class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
              ></span>
              <span
                v-else-if="pluginStore.getPluginHealth(op.params?.pluginId).status === 'unhealthy'"
                class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"
              ></span>
              <LoaderCircle
                v-else-if="pluginStore.getPluginHealth(op.params?.pluginId).status === 'checking'"
                class="w-2.5 h-2.5 animate-spin text-blue-500 shrink-0"
              />
              <span v-else class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>

              <span>
                {{
                  pluginStore.getPluginHealth(op.params?.pluginId).status === 'healthy'
                    ? (pluginStore.getPluginHealth(op.params?.pluginId).latencyMs !== undefined
                        ? `連線正常 (${pluginStore.getPluginHealth(op.params?.pluginId).latencyMs}ms)`
                        : '連線正常')
                    : pluginStore.getPluginHealth(op.params?.pluginId).status === 'unhealthy'
                    ? '服務異常 (重試)'
                    : pluginStore.getPluginHealth(op.params?.pluginId).status === 'checking'
                    ? '檢測中...'
                    : '檢測連線'
                }}
              </span>
            </button>

            <!-- Plugin Running Indicator -->
            <span v-if="op.type === 'plugin' && pluginStore.getPluginStatus(op.params?.pluginId).isBusy"
              class="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 flex items-center gap-1">
              <LoaderCircle class="w-2.5 h-2.5 animate-spin" />
              <span>運算中...</span>
            </span>
          </div>

          <!-- Plugin Execution Error Alert -->
          <div v-if="op.type === 'plugin' && pluginStore.getPluginStatus(op.params?.pluginId).lastError"
            class="mb-3 p-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div class="min-w-0">
              <div class="font-semibold text-[11.5px]">外掛運算錯誤</div>
              <div class="text-[11px] opacity-90 break-all font-mono">{{ pluginStore.getPluginStatus(op.params?.pluginId).lastError }}</div>
            </div>
          </div>

          <!-- REGEX OPERATION FORM -->
          <div v-if="op.type === 'regex'" class="space-y-3">
            <div class="space-y-1">
              <div class="flex justify-between items-center mb-1">
                <label class="text-xs font-medium text-slate-600 dark:text-slate-400 ml-0.5">{{ $t('operations.patternLabel')
                  }}</label>
                <label class="flex items-center gap-1.5 cursor-pointer group/cb select-none">
                  <div class="relative flex items-center justify-center shrink-0">
                    <input type="checkbox" v-model="op.params.useRegex" class="sr-only peer">
                    <div
                      class="w-3.5 h-3.5 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40 transition-all flex items-center justify-center shadow-2xs group-hover/cb:border-slate-400 dark:group-hover/cb:border-slate-500">
                      <Check v-if="op.params.useRegex" class="w-2.5 h-2.5 text-white stroke-[3.5]" />
                    </div>
                  </div>
                  <span class="text-xs text-slate-500 dark:text-slate-400 group-hover/cb:text-slate-700 dark:group-hover/cb:text-slate-300 transition-colors leading-none pt-px">{{ $t('operations.useRegex') }}</span>
                </label>
              </div>
              <input v-model="op.params.pattern" type="text"
                :placeholder="op.params.useRegex ? $t('operations.placeholderPatternRegex') : $t('operations.placeholderPatternText')"
                class="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono" />
            </div>
            <div class="space-y-1">
              <div class="text-xs text-slate-600 dark:text-slate-400 ml-1 flex justify-between items-center">
                <span>{{ $t('operations.replacementLabel') }}</span>
                <button @click="openHelper(op.id)"
                  class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer">
                  <Zap class="h-3.5 w-3.5" />
                  <span>{{ $t('operations.variableHelper') }}</span>
                </button>
              </div>
              <input :ref="(el) => setInputRef(el, op.id)" v-model="op.params.replacement" type="text"
                :placeholder="$t('operations.placeholderReplacement')"
                class="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all" />
            </div>
          </div>

          <!-- PLUGIN OPERATION FORM (DYNAMIC SCHEMA-DRIVEN) -->
          <div v-else-if="op.type === 'plugin'" class="space-y-3">
            <template v-if="pluginStore.getPlugin(op.params.pluginId)">
              <div
                v-for="option in (pluginStore.getPlugin(op.params.pluginId)?.manifest.options || [])"
                :key="option.key"
                class="space-y-1"
              >
                <div class="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400 ml-0.5">
                  <span>{{ option.label }}</span>
                  <span v-if="option.description" class="text-[10.5px] text-slate-400 font-normal truncate max-w-[200px]" :title="option.description">
                    {{ option.description }}
                  </span>
                </div>

                <!-- Custom Select Option -->
                <CustomSelect
                  v-if="option.type === 'select'"
                  v-model="op.params[option.key]"
                  :options="option.options || []"
                  @toggle="(isOpen) => { openDropdownOpId = isOpen ? op.id : null }"
                />

                <!-- Boolean Option (Checkbox) -->
                <label v-else-if="option.type === 'boolean'" class="flex items-center gap-2 cursor-pointer pt-1 select-none">
                  <div class="relative flex items-center justify-center shrink-0">
                    <input type="checkbox" v-model="op.params[option.key]" class="sr-only peer">
                    <div
                      class="w-4 h-4 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/40 transition-all flex items-center justify-center shadow-2xs">
                      <Check v-if="op.params[option.key]" class="w-3 h-3 text-white stroke-[3.5]" />
                    </div>
                  </div>
                  <span class="text-xs text-slate-600 dark:text-slate-300">{{ option.label }}</span>
                </label>

                <!-- String Option -->
                <input
                  v-else-if="option.type === 'string'"
                  type="text"
                  v-model="op.params[option.key]"
                  class="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />

                <!-- Number Option -->
                <input
                  v-else-if="option.type === 'number'"
                  type="number"
                  :min="option.min"
                  :max="option.max"
                  :step="option.step"
                  v-model.number="op.params[option.key]"
                  class="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </template>

            <div v-else class="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <span>插件尚未安裝或已被停用 (ID: {{ op.params.pluginId }})</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="operationStore.operations.length === 0"
        class="text-center py-8 text-slate-500 dark:text-slate-500 text-sm italic">
        {{ $t('operations.empty') }}
      </div>
    </div>

    <!-- Variable Helper Modal -->
    <Teleport to="body">
      <div v-if="operationDragPreview.visible && draggedOperation"
        class="fixed z-[100000] pointer-events-none max-w-xs rounded-lg border border-blue-300 dark:border-blue-500 bg-white/95 dark:bg-slate-900/95 px-3 py-2 shadow-xl ring-1 ring-blue-500/20"
        :style="{ left: `${operationDragPreview.x + 14}px`, top: `${operationDragPreview.y + 14}px` }">
        <div class="text-xs font-semibold text-blue-600 dark:text-blue-300">#{{ getOperationIndexById(draggedOperation.id)
          + 1 }}</div>
        <div class="truncate text-sm text-slate-800 dark:text-slate-100">
          {{ draggedOperation.type === 'regex' ? $t('operations.regex') : $t('operations.other') }}
        </div>
      </div>
      <Transition name="fade">
        <div v-if="activeHelperId" class="fixed inset-0 z-50 flex items-center justify-center p-4 pt-10">
          <!-- Top Titlebar Window Drag Region (Pass-through for macOS window dragging) -->
          <div data-tauri-drag-region class="absolute top-0 left-0 right-0 h-[38px] z-10 pointer-events-auto"></div>

          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeHelper"></div>

          <!-- Modal -->
          <div
            class="relative z-20 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm space-y-5 animate-in zoom-in-95 duration-200">
            <!-- Header -->
            <div
              data-tauri-drag-region
              class="flex items-center justify-between select-none shrink-0">
              <h3 class="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2 no-drag">
                <Zap class="h-5 w-5" />
                {{ $t('operations.variableHelper') }}
              </h3>

              <!-- Middle Drag Area -->
              <div data-tauri-drag-region class="flex-1 h-full min-w-4"></div>

              <button @click="closeHelper"
                class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer no-drag">
                <X class="h-5 w-5" />
              </button>
            </div>

            <!-- Content -->
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {{ $t('operations.variableWidth') }}
                </label>
                <input type="number" v-model.number="helperWidth" min="1" max="10"
                  class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50">
              </div>
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {{ $t('operations.variableStart') }}
                </label>
                <input type="number" v-model.number="helperStart" min="0"
                  class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50">
              </div>

              <!-- Real-time Preview -->
              <div class="p-3 bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-lg space-y-1">
                <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {{ $t('operations.preview') }}
                </div>
                <div class="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 tracking-wide select-text">
                  {{ helperPreviewList }}
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex gap-3 pt-2">
              <button @click="closeHelper"
                class="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                {{ $t('common.cancel') }}
              </button>
              <button @click="insertVariable"
                class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer">
                {{ $t('operations.insert') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Prefix/Suffix Input Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showPrefixSuffixModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 pt-10">
          <!-- Top Titlebar Window Drag Region (Pass-through for macOS window dragging) -->
          <div data-tauri-drag-region class="absolute top-0 left-0 right-0 h-[38px] z-10 pointer-events-auto"></div>

          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closePrefixSuffixModal"></div>

          <!-- Modal -->
          <div
            class="relative z-20 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm space-y-5 animate-in zoom-in-95 duration-200">
            <!-- Header -->
            <div
              data-tauri-drag-region
              class="flex items-center justify-between select-none shrink-0">
              <h3 class="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2 no-drag">
                <Pencil class="h-5 w-5" />
                {{ prefixSuffixMode === 'prefix' ? $t('operations.template.addPrefix') :
                  $t('operations.template.addSuffix') }}
              </h3>

              <!-- Middle Drag Area -->
              <div data-tauri-drag-region class="flex-1 h-full min-w-4"></div>

              <button @click="closePrefixSuffixModal"
                class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer no-drag">
                <X class="h-5 w-5" />
              </button>
            </div>

            <!-- Content -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {{ prefixSuffixMode === 'prefix' ? $t('operations.template.enterPrefix') :
                  $t('operations.template.enterSuffix') }}
              </label>
              <input type="text" v-model="prefixSuffixValue"
                @keydown.enter="!$event.isComposing && confirmPrefixSuffix()" autofocus
                class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50" />
            </div>

            <!-- Footer -->
            <div class="flex gap-3 pt-2">
              <button @click="closePrefixSuffixModal"
                class="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                {{ $t('common.cancel') }}
              </button>
              <button @click="confirmPrefixSuffix"
                class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer">
                {{ $t('operations.insert') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Save Preset Name Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showSavePresetModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 pt-10">
          <!-- Top Titlebar Window Drag Region (Pass-through for macOS window dragging) -->
          <div data-tauri-drag-region class="absolute top-0 left-0 right-0 h-[38px] z-10 pointer-events-auto"></div>

          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeSavePresetModal"></div>
          <div
            class="relative z-20 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm space-y-5 animate-in zoom-in-95 duration-200">
            <div
              data-tauri-drag-region
              class="flex items-center justify-between select-none shrink-0">
              <h3 class="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2 no-drag">
                <Save class="h-5 w-5" />
                {{ $t('templates.saveCurrent') }}
              </h3>

              <!-- Middle Drag Area -->
              <div data-tauri-drag-region class="flex-1 h-full min-w-4"></div>

              <button @click="closeSavePresetModal"
                class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer no-drag">
                <X class="h-5 w-5" />
              </button>
            </div>
            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {{ $t('templates.enterName') }}
              </label>
              <input type="text" v-model="savePresetName" @keydown.enter="!$event.isComposing && confirmSavePreset()"
                autofocus
                class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50" />
            </div>
            <div class="flex gap-3 pt-2">
              <button @click="closeSavePresetModal"
                class="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer">
                {{ $t('common.cancel') }}
              </button>
              <button @click="confirmSavePreset"
                class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                :disabled="!savePresetName.trim()">
                {{ $t('common.confirm') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <HelpModal v-model="showHelp" />

    <PresetManager v-if="showPresetManager" @close="showPresetManager = false" @loaded="handlePresetLoaded" />

    <PluginModal v-model="showPluginModal" />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

</style>
