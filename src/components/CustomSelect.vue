<script setup lang="ts">
import { ref, computed, onUnmounted, nextTick, watch } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

export interface SelectOption {
  value: string | number
  label: string
  description?: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    options: SelectOption[]
    placeholder?: string
    disabled?: boolean
    size?: 'sm' | 'md'
  }>(),
  {
    modelValue: '',
    placeholder: '請選擇...',
    disabled: false,
    size: 'md'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'change', value: string | number): void
  (e: 'toggle', isOpen: boolean): void
}>()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue)
})

const displayLabel = computed(() => {
  return selectedOption.value ? selectedOption.value.label : props.placeholder
})

function toggleDropdown() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

function selectOption(opt: SelectOption) {
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
  isOpen.value = false
}

function handleClickOutside(e: MouseEvent | PointerEvent) {
  if (!isOpen.value) return
  const target = e.target as Node | null
  if (containerRef.value && target && !containerRef.value.contains(target)) {
    isOpen.value = false
  }
}

watch(isOpen, (open) => {
  emit('toggle', open)
  if (open) {
    nextTick(() => {
      window.addEventListener('pointerdown', handleClickOutside)
    })
  } else {
    window.removeEventListener('pointerdown', handleClickOutside)
  }
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', handleClickOutside)
})
</script>

<template>
  <div ref="containerRef" class="relative w-full select-none" :class="{ 'z-50': isOpen }">
    <!-- Trigger Button -->
    <button
      type="button"
      @click="toggleDropdown"
      :disabled="disabled"
      :title="displayLabel"
      class="w-full bg-white dark:bg-slate-900/60 border rounded-lg px-3 text-slate-800 dark:text-slate-100 flex items-center justify-between transition-all cursor-pointer shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 focus:outline-hidden"
      :class="[
        isOpen
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-slate-300 dark:border-slate-700',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
        size === 'sm' ? 'py-1.5 text-xs' : 'py-2 text-sm'
      ]"
    >
      <span class="truncate text-xs font-medium" :class="{ 'text-slate-400 dark:text-slate-500': !selectedOption }">
        {{ displayLabel }}
      </span>
      <ChevronDown
        class="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ml-2"
        :class="{ 'rotate-180 text-blue-500': isOpen }"
      />
    </button>

    <!-- Dropdown Options Menu -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute z-50 left-0 right-0 w-full mt-1.5 py-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl max-h-60 overflow-y-auto custom-scrollbar"
      >
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          @click="selectOption(opt)"
          :title="opt.label"
          class="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-colors cursor-pointer"
          :class="[
            opt.value === modelValue
              ? 'bg-blue-50/80 dark:bg-blue-950/50 font-semibold text-blue-600 dark:text-blue-400'
              : 'text-slate-700 dark:text-slate-200'
          ]"
        >
          <span class="truncate pr-2">{{ opt.label }}</span>
          <Check v-if="opt.value === modelValue" class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 ml-1" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
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
