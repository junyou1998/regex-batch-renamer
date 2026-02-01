<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { useOperationStore } from '../stores/operationStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from 'vue-i18n'
import HelpModal from './HelpModal.vue'

defineProps<{
  canUndo?: boolean
}>()

const emit = defineEmits<{
  (e: 'undo'): void
}>()

const operationStore = useOperationStore()
const settingsStore = useSettingsStore()
useI18n()
const showHelp = ref(false)

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

function addRegexOperation() {
  operationStore.addOperation('regex', { pattern: '', replacement: '', useRegex: settingsStore.defaultUseRegex })
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
})

const showTemplateDropdown = ref(false)
const showPrefixSuffixModal = ref(false)
const prefixSuffixMode = ref<'prefix' | 'suffix'>('prefix')
const prefixSuffixValue = ref('')

function toggleTemplateDropdown() {
  showTemplateDropdown.value = !showTemplateDropdown.value
}

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
      break
    case 'spacesToUnderscore':
      operationStore.addOperation('regex', {
        pattern: '\\s+',
        replacement: '_',
        useRegex: true
      })
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
  if (!target.closest('.template-dropdown-container')) {
    showTemplateDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <h2 class="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
        <span class="w-1 h-5 bg-blue-500 rounded-full"></span>
        {{ $t('operations.title') }}

        <button @click="showHelp = true"
          class="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
          title="使用說明與 Regex 教學">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clip-rule="evenodd" />
          </svg>
        </button>

        <button v-if="canUndo" @click="emit('undo')"
          class="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer ml-1"
          :title="$t('app.undo')">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd"
              d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
        </button>
      </h2>
      <div class="flex items-center gap-2">
        <!-- Quick Templates Dropdown -->
        <div class="relative template-dropdown-container">
          <button @click.stop="toggleTemplateDropdown"
            class="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
            <span>⚡</span>
            {{ $t('operations.quickTemplates') }}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ml-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Dropdown Menu -->
          <Transition name="dropdown">
            <div v-if="showTemplateDropdown"
              class="absolute left-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50">
              <button @click="applyTemplate('removeSpaces')"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                {{ $t('operations.template.removeSpaces') }}
              </button>
              <button @click="applyTemplate('spacesToUnderscore')"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                {{ $t('operations.template.spacesToUnderscore') }}
              </button>
              <div class="border-t border-slate-200 dark:border-slate-700 my-1"></div>
              <button @click="applyTemplate('addPrefix')"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                {{ $t('operations.template.addPrefix') }}
              </button>
              <button @click="applyTemplate('addSuffix')"
                class="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                {{ $t('operations.template.addSuffix') }}
              </button>
            </div>
          </Transition>
        </div>

        <button @click="addRegexOperation"
          class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer">
          <span>+</span> {{ $t('operations.add') }}
        </button>
      </div>
    </div>

    <div class="space-y-3">
      <div v-for="(op, index) in operationStore.operations" :key="op.id"
        class="bg-slate-200/50 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-300 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-all hover:border-slate-400 dark:hover:border-slate-600 group"
        :class="{ 'opacity-50 grayscale': !op.enabled }">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-500">#{{ index + 1 }}</span>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
              {{ op.type === 'regex' ? $t('operations.regex') : $t('operations.other') }}
            </span>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button @click="operationStore.toggleOperation(op.id)"
              class="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer mr-2"
              :title="$t('operations.toggleEnable')">
              <svg v-if="op.enabled" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20"
                fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fill-rule="evenodd"
                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clip-rule="evenodd" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd"
                  d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                  clip-rule="evenodd" />
                <path
                  d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            </button>
            <button @click="operationStore.moveOperation(op.id, 'up')"
              class="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              :title="$t('operations.moveUp')">↑</button>
            <button @click="operationStore.moveOperation(op.id, 'down')"
              class="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              :title="$t('operations.moveDown')">↓</button>
            <button @click="operationStore.removeOperation(op.id)"
              class="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-900/30 ml-1 cursor-pointer"
              :title="$t('operations.remove')">×</button>
          </div>
        </div>

        <div v-if="op.type === 'regex'" class="space-y-3">
          <div class="space-y-1">
            <div class="flex justify-between items-center">
              <label class="text-xs text-slate-600 dark:text-slate-400 ml-1">{{ $t('operations.patternLabel') }}</label>
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
                <span>⚡ {{ $t('operations.variableHelper') }}</span>
              </button>
            </div>
            <input :ref="(el) => setInputRef(el, op.id)" v-model="op.params.replacement" type="text"
              :placeholder="$t('operations.placeholderReplacement')"
              class="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all" />
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
                <span class="text-lg">⚡</span>
                {{ $t('operations.variableHelper') }}
              </h3>
              <button @click="closeHelper"
                class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd" />
                </svg>
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
                <span class="text-lg">📝</span>
                {{ prefixSuffixMode === 'prefix' ? $t('operations.template.addPrefix') :
                  $t('operations.template.addSuffix') }}
              </h3>
              <button @click="closePrefixSuffixModal"
                class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd" />
                </svg>
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

    <HelpModal v-model="showHelp" />
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
