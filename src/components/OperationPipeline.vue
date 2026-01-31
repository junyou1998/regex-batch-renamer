<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { useOperationStore } from '../stores/operationStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from 'vue-i18n'
import HelpModal from './HelpModal.vue'

const operationStore = useOperationStore()
const settingsStore = useSettingsStore()
useI18n()
const showHelp = ref(false)

onMounted(() => {
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
        class="bg-slate-200/50 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-300 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-all hover:border-slate-400 dark:hover:border-slate-600 group">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-500">#{{ index + 1 }}</span>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
              {{ op.type === 'regex' ? $t('operations.regex') : $t('operations.other') }}
            </span>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              <input type="text" v-model="prefixSuffixValue" @keydown.enter="confirmPrefixSuffix" autofocus
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
