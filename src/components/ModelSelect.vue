<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch, type CSSProperties } from 'vue'
import { Check, ChevronDown, LoaderCircle, RefreshCw } from 'lucide-vue-next'

/**
 * Model picker: a dropdown of the models the provider actually offers, with
 * type-to-filter. Typing an ID that isn't listed is still allowed (custom
 * endpoints, brand-new models).
 */
const props = defineProps<{
  modelValue?: string
  models: readonly string[]
  loading?: boolean
  /** True once a live list was fetched from the provider. */
  live?: boolean
  placeholder?: string
  canLoad?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  load: []
}>()

const isOpen = ref(false)
const query = ref('')
/** True once the user typed since opening; until then the full list shows. */
const isFiltering = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const fieldRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const listStyle = ref<CSSProperties>({})

const LIST_MAX_HEIGHT = 300

/**
 * The list is teleported to <body> with fixed positioning so a scrolling
 * parent (like the Settings dialog) can't clip it. Opens upward when there
 * isn't room below.
 */
function positionList() {
  const field = fieldRef.value
  if (!field) return
  const rect = field.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 12
  const spaceAbove = rect.top - 12
  const openUp = spaceBelow < 200 && spaceAbove > spaceBelow
  const maxHeight = Math.min(LIST_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow)
  listStyle.value = {
    position: 'fixed',
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: `${maxHeight}px`,
    ...(openUp ? { bottom: `${window.innerHeight - rect.top + 6}px` } : { top: `${rect.bottom + 6}px` }),
  }
}

/** Family = the name before the first version number, e.g. `gemini-`, `gemma-`, `claude-opus-`. */
function familyOf(model: string) {
  return model.toLowerCase().split(/\d/)[0]
}

/** Aliases (`*-latest`) first, then grouped by family, newest version first. */
const sortedModels = computed(() => {
  const unique = [...new Set(props.models)]
  return unique.sort((a, b) => {
    const aliasA = a.endsWith('-latest') ? 0 : 1
    const aliasB = b.endsWith('-latest') ? 0 : 1
    if (aliasA !== aliasB) return aliasA - aliasB
    const family = familyOf(a).localeCompare(familyOf(b))
    if (family !== 0) return family
    return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
  })
})

const filteredModels = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!isFiltering.value || !q) return sortedModels.value
  return sortedModels.value.filter(m => m.toLowerCase().includes(q))
})

const isCustomValue = computed(() => {
  const value = (props.modelValue || '').trim()
  return Boolean(value) && props.live && !props.models.includes(value)
})

function open() {
  if (isOpen.value) return
  query.value = props.modelValue || ''
  isFiltering.value = false
  isOpen.value = true
  if (!props.live && props.canLoad && !props.loading) emit('load')
}

function close() {
  isOpen.value = false
}

function choose(model: string) {
  emit('update:modelValue', model)
  query.value = model
  close()
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (!isOpen.value) open()
  query.value = value
  isFiltering.value = true
  emit('update:modelValue', value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    event.stopPropagation()
    close()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (isFiltering.value && filteredModels.value.length > 0) choose(filteredModels.value[0])
    else close()
  } else if (event.key === 'ArrowDown' && !isOpen.value) {
    open()
  }
}

function toggle() {
  if (isOpen.value) close()
  else {
    open()
    nextTick(() => inputRef.value?.focus())
  }
}

function handleOutside(event: PointerEvent) {
  const target = event.target as Node
  if (rootRef.value?.contains(target) || listRef.value?.contains(target)) return
  close()
}

function attach() {
  window.addEventListener('pointerdown', handleOutside)
  window.addEventListener('resize', positionList)
  window.addEventListener('scroll', positionList, true)
}

function detach() {
  window.removeEventListener('pointerdown', handleOutside)
  window.removeEventListener('resize', positionList)
  window.removeEventListener('scroll', positionList, true)
}

watch(isOpen, (value) => {
  if (value) {
    positionList()
    nextTick(attach)
  } else {
    detach()
  }
})
onUnmounted(detach)
</script>

<template>
  <div ref="rootRef" class="relative w-full" :class="{ 'z-40': isOpen }">
    <div
      ref="fieldRef"
      class="flex items-center rounded-lg border bg-slate-50 dark:bg-slate-800/80 transition-all"
      :class="isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700'"
    >
      <input
        ref="inputRef"
        type="text"
        role="combobox"
        :aria-expanded="isOpen"
        aria-autocomplete="list"
        autocomplete="off"
        spellcheck="false"
        :value="modelValue"
        :placeholder="placeholder"
        @focus="open"
        @input="onInput"
        @keydown="onKeydown"
        class="flex-1 min-w-0 bg-transparent px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-hidden"
      />
      <button
        type="button"
        tabindex="-1"
        @click="toggle"
        class="px-2 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
        :aria-label="$t('settings.modelPickerToggle')"
      >
        <LoaderCircle v-if="loading" class="w-4 h-4 animate-spin" />
        <ChevronDown v-else class="w-4 h-4 transition-transform" :class="{ 'rotate-180 text-blue-500': isOpen }" />
      </button>
    </div>

    <p v-if="isCustomValue && !isOpen" class="mt-1 text-[10px] text-amber-600 dark:text-amber-400">
      {{ $t('settings.modelNotInList') }}
    </p>

    <Teleport to="body">
    <div
      v-if="isOpen"
      ref="listRef"
      role="listbox"
      :style="listStyle"
      class="z-[10000] flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl overflow-hidden"
    >
      <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-1">
        <button
          v-for="model in filteredModels"
          :key="model"
          type="button"
          role="option"
          :aria-selected="model === modelValue"
          @click="choose(model)"
          class="w-full px-3 py-1.5 text-left text-xs font-mono flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/80 cursor-pointer"
          :class="model === modelValue ? 'bg-blue-50/80 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-slate-200'"
        >
          <span class="truncate">{{ model }}</span>
          <Check v-if="model === modelValue" class="w-3.5 h-3.5 shrink-0 ml-2" />
        </button>
        <p v-if="filteredModels.length === 0" class="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
          {{ loading ? $t('settings.modelsLoading') : $t('settings.modelsNoMatch') }}
        </p>
      </div>
      <div class="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-500 dark:text-slate-400">
        <span>{{ live ? $t('settings.modelsLiveCount', { n: models.length }) : $t('settings.modelsSuggested') }}</span>
        <button
          v-if="canLoad"
          type="button"
          @click="emit('load')"
          :disabled="loading"
          class="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': loading }" />
          {{ live ? $t('settings.reloadModels') : $t('settings.loadModels') }}
        </button>
      </div>
    </div>
    </Teleport>
  </div>
</template>
