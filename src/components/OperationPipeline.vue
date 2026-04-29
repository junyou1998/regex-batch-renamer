<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick, computed } from 'vue'
import { useOperationStore, type Operation } from '../stores/operationStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from 'vue-i18n'
import HelpModal from './HelpModal.vue'
import PresetManager from './PresetManager.vue'
import { savePreset, loadPresets, type Preset } from '../services/presetService'
import { useToastStore } from '../stores/toastStore'
import {
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
  let node = operationsList.value?.parentElement ?? null

  while (node) {
    const style = window.getComputedStyle(node)
    const canScroll = /(auto|scroll)/.test(`${style.overflowY}${style.overflow}`)
    if (canScroll && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }

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
}

function getBadges(op: any): Badge[] {
  const badges: Badge[] = []
  if (op.type !== 'regex') return badges

  const pattern = op.params.pattern || ''
  const replacement = op.params.replacement || ''

  // Prefix detection: Pattern is exactly '^'
  if (pattern === '^') {
    badges.push({ type: 'prefix', label: 'badges.prefix', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' })
  }

  // Suffix detection: Pattern is exactly '$'
  if (pattern === '$') {
    badges.push({ type: 'suffix', label: 'badges.suffix', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' })
  }

  // Sequence detection: Replacement contains strictly valid ${n...}
  if (/\$\{n(?::\d+(?::\d+)?)?\}/.test(replacement)) {
    badges.push({ type: 'sequence', label: 'badges.sequence', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' })
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
  operationStore.addOperation('regex', { pattern: '', replacement: '', useRegex: settingsStore.defaultUseRegex })
  scrollToBottom()
}

const activeHelperId = ref<string | null>(null)
// ... existing helper logic ...
const helperWidth = ref(3)
const helperStart = ref(1)
const inputRefs = ref<Record<string, HTMLInputElement>>({})

function setInputRef(el: any, id: string) {
  if (el) inputRefs.value[id] = el
}

function openHelper(id: string) {
  activeHelperId.value = id
  helperWidth.value = 0
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
  // ... existing variable logic ...
  if (!activeHelperId.value) return

  const op = operationStore.operations.find(o => o.id === activeHelperId.value)
  if (!op) return

  const width = helperWidth.value
  const start = helperStart.value

  let varStr = '${n'
  if (width > 0 || start !== 1) {
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
const templateTriggerRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})
const savedTemplates = ref<Preset[]>([])

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

function updateDropdownPosition() {
  if (!templateTriggerRef.value) return
  const rect = templateTriggerRef.value.getBoundingClientRect()
  const gap = 4
  const padding = 12
  const top = rect.bottom + gap
  const maxH = Math.max(120, window.innerHeight - top - padding)
  dropdownStyle.value = {
    top: `${top}px`,
    left: `${rect.left}px`,
    maxHeight: `${maxH}px`,
  }
}

function onResizeOrScroll() {
  if (showTemplateDropdown.value) updateDropdownPosition()
}

function toggleTemplateDropdown() {
  if (!showTemplateDropdown.value) {
    refreshSavedTemplates()
  }
  showTemplateDropdown.value = !showTemplateDropdown.value
  if (showTemplateDropdown.value) {
    nextTick(() => updateDropdownPosition())
  }
}

watch(showTemplateDropdown, (open) => {
  if (open) {
    window.addEventListener('resize', onResizeOrScroll)
    window.addEventListener('scroll', onResizeOrScroll, true)
  } else {
    window.removeEventListener('resize', onResizeOrScroll)
    window.removeEventListener('scroll', onResizeOrScroll, true)
  }
})

function applyTemplate(templateId: string) {
  // ... existing template logic ...
  showTemplateDropdown.value = false

  switch (templateId) {
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

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.template-dropdown-container') && !target.closest('.template-dropdown-portal')) {
    showTemplateDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', onResizeOrScroll)
  window.removeEventListener('scroll', onResizeOrScroll, true)
})
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex items-center justify-between flex-wrap gap-2 sticky top-0 z-30 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md py-3 -mx-4 px-4 border-b border-slate-200/50 dark:border-slate-700/50 shadow-sm transition-all">
      <h2 class="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
        <span class="w-1 h-5 bg-blue-500 rounded-full"></span>
        {{ $t('operations.title') }}

        <button @click="showHelp = true"
          class="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
          title="使用說明與 Regex 教學">
          <HelpCircle class="h-5 w-5" />
        </button>

        <button v-if="canUndo" @click="emit('undo')"
          class="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer ml-1"
          :title="$t('app.undo')">
          <Undo2 class="h-5 w-5" />
        </button>
      </h2>
      <div class="flex items-center gap-2">
        <!-- Templates Dropdown (built-in + custom) -->
        <div class="relative template-dropdown-container">
          <button ref="templateTriggerRef" @click.stop="toggleTemplateDropdown"
            class="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
            <Zap class="h-3.5 w-3.5" />
            {{ $t('operations.quickTemplates') }}
            <ChevronDown class="h-3 w-3 ml-0.5" />
          </button>
        </div>

        <!-- Teleported Dropdown Menu -->
        <Teleport to="body">
          <Transition name="dropdown">
            <div v-if="showTemplateDropdown"
              class="template-dropdown-portal fixed w-56 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 py-1 z-9999 overflow-y-auto custom-scrollbar"
              :style="dropdownStyle">

              <!-- Built-in Templates Section -->
              <div
                class="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {{ $t('templates.sectionBuiltIn') }}
              </div>
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
        </Teleport>

        <button @click="addRegexOperation"
          class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer">
          <Plus class="h-3.5 w-3.5" /> {{ $t('operations.add') }}
        </button>
      </div>
    </div>

    <div class="space-y-3" ref="operationsList">
      <div class="space-y-3">
        <div v-for="(op, index) in operationsModel" :key="op.id" :data-operation-id="op.id"
          class="relative bg-slate-200/50 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-300 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-colors hover:border-slate-400 dark:hover:border-slate-600 group"
          :class="{
            'opacity-50 grayscale': !op.enabled,
            'ring-2 ring-blue-400/50 bg-blue-50 dark:bg-blue-950/30': activeOperationDragId === op.id,
            '!border-t-4 !border-t-blue-500 dark:!border-t-blue-400': operationDropTargetId === op.id && operationDropPosition === 'before',
            '!border-b-4 !border-b-blue-500 dark:!border-b-blue-400': operationDropTargetId === op.id && operationDropPosition === 'after'
          }">
          <div class="flex items-center justify-between mb-3 select-none group/header">
            <div class="flex items-center gap-2">
              <button type="button"
                class="drag-handle inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-300/70 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300 cursor-grab active:cursor-grabbing"
                @pointerdown.stop="startOperationReorder($event, op.id)"
                :title="$t('operations.reorder')">
                <GripVertical class="h-4 w-4" />
              </button>
              <span class="text-xs font-bold text-slate-500 dark:text-slate-500">#{{ index + 1 }}</span>
              <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
                {{ op.type === 'regex' ? $t('operations.regex') : $t('operations.other') }}
              </span>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

          <!-- Smart Badges (New Row) -->
          <div v-if="getBadges(op).length" class="flex gap-1 mb-3 -mt-1">
            <span v-for="badge in getBadges(op)" :key="badge.type"
              class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md" :class="badge.color">
              {{ $t(badge.label) }}
            </span>
          </div>

          <div v-if="op.type === 'regex'" class="space-y-3">
            <div class="space-y-1">
              <div class="flex justify-between items-center">
                <label class="text-xs text-slate-600 dark:text-slate-400 ml-1">{{ $t('operations.patternLabel')
                  }}</label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" v-model="op.params.useRegex"
                    class="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                  <span class="text-xs text-slate-500 dark:text-slate-400">{{ $t('operations.useRegex') }}</span>
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
        <div v-if="activeHelperId" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeHelper"></div>

          <!-- Modal -->
          <div
            class="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm space-y-5 animate-in zoom-in-95 duration-200">
            <!-- Header -->
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Zap class="h-5 w-5" />
                {{ $t('operations.variableHelper') }}
              </h3>
              <button @click="closeHelper"
                class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                <X class="h-5 w-5" />
              </button>
            </div>

            <!-- Content -->
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {{ $t('operations.variableWidth') }}
                </label>
                <input type="number" v-model.number="helperWidth" min="0" max="10"
                  class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50">
              </div>
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {{ $t('operations.variableStart') }}
                </label>
                <input type="number" v-model.number="helperStart" min="0"
                  class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50">
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
        <div v-if="showPrefixSuffixModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closePrefixSuffixModal"></div>

          <!-- Modal -->
          <div
            class="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm space-y-5 animate-in zoom-in-95 duration-200">
            <!-- Header -->
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Pencil class="h-5 w-5" />
                {{ prefixSuffixMode === 'prefix' ? $t('operations.template.addPrefix') :
                  $t('operations.template.addSuffix') }}
              </h3>
              <button @click="closePrefixSuffixModal"
                class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
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
        <div v-if="showSavePresetModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeSavePresetModal"></div>
          <div
            class="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 w-full max-w-sm space-y-5 animate-in zoom-in-95 duration-200">
            <div class="flex items-center justify-between">
              <h3 class="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <Save class="h-5 w-5" />
                {{ $t('templates.saveCurrent') }}
              </h3>
              <button @click="closeSavePresetModal"
                class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
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
