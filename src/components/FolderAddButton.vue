<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, FolderPlus, FolderTree, FolderPen } from 'lucide-vue-next'
import { desktop } from '../services/desktop'
import { useToastStore } from '../stores/toastStore'

/**
 * "Add folder" split button.
 * Main click: add the files inside a folder (the common case).
 * Menu: include subfolders, or add the folder itself to rename folders.
 */
const props = withDefaults(defineProps<{ variant?: 'toolbar' | 'empty' }>(), { variant: 'toolbar' })
const emit = defineEmits<{ add: [paths: string[]] }>()

const { t } = useI18n()
const toastStore = useToastStore()
const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<CSSProperties>({})

type Mode = 'contents' | 'recursive' | 'folder'

async function pick(mode: Mode) {
  isOpen.value = false
  try {
    const paths = mode === 'folder'
      ? await desktop.selectFolderAsItem()
      : await desktop.selectFolderContents({ recursive: mode === 'recursive' })
    if (paths.length > 0) emit('add', paths)
    else if (mode !== 'folder') toastStore.addToast(t('preview.folderEmpty'), 'info', 3000)
  } catch (error) {
    console.error('Failed to select folder:', error)
    toastStore.addToast(t('errors.selectDirectoryFailed'), 'error')
  }
}

function position() {
  const rect = rootRef.value?.getBoundingClientRect()
  if (!rect) return
  const width = 260
  menuStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))}px`,
    width: `${width}px`,
  }
}

function onOutside(event: PointerEvent) {
  const target = event.target as Node
  if (rootRef.value?.contains(target) || menuRef.value?.contains(target)) return
  isOpen.value = false
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') isOpen.value = false
}

watch(isOpen, (open) => {
  if (open) {
    position()
    nextTick(() => {
      window.addEventListener('pointerdown', onOutside)
      window.addEventListener('keydown', onKey)
      window.addEventListener('resize', position)
    })
  } else {
    window.removeEventListener('pointerdown', onOutside)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', position)
  }
})
onUnmounted(() => {
  window.removeEventListener('pointerdown', onOutside)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', position)
})

const toolbarBtn = 'inline-flex items-center gap-1.5 text-control font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 py-1 border border-slate-300 dark:border-slate-600 shadow-2xs transition-colors cursor-pointer whitespace-nowrap'
const emptyBtn = 'inline-flex items-center gap-1.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-control font-medium transition-colors cursor-pointer whitespace-nowrap'
</script>

<template>
  <div ref="rootRef" class="inline-flex">
    <button
      type="button"
      @click="pick('contents')"
       v-tooltip="{ title: t('preview.addFolder'), desc: t('preview.addFolderHint'), placement: 'bottom' }"
      :aria-label="t('preview.addFolder')"
      :class="[props.variant === 'toolbar' ? toolbarBtn : emptyBtn, props.variant === 'toolbar' ? 'pl-2.5 pr-2 rounded-l-md' : 'pl-3.5 pr-2.5 rounded-l-lg']"
    >
      <FolderPlus class="w-3.5 h-3.5" :class="props.variant === 'toolbar' ? 'text-blue-500' : ''" />
      <span :class="props.variant === 'toolbar' ? 'hidden @xl:inline' : ''">{{ t('preview.addFolder') }}</span>
    </button>
    <button
      type="button"
      @click="isOpen = !isOpen"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
       v-tooltip="{ title: t('preview.folderOptions'), placement: 'bottom' }"
      :aria-label="t('preview.folderOptions')"
      :class="[props.variant === 'toolbar' ? toolbarBtn : emptyBtn, props.variant === 'toolbar' ? 'px-1 rounded-r-md border-l-0' : 'px-1.5 rounded-r-lg border-l border-slate-300/70 dark:border-slate-600']"
    >
      <ChevronDown class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-180': isOpen }" />
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="menuRef"
        role="menu"
        :style="menuStyle"
        class="z-[10000] py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl"
      >
        <button type="button" role="menuitem" @click="pick('contents')"
          class="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/80 cursor-pointer">
          <FolderPlus class="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
          <span class="min-w-0">
            <span class="block text-control font-medium text-slate-800 dark:text-slate-100">{{ t('preview.addFolderFiles') }}</span>
            <span class="block text-caption text-slate-500 dark:text-slate-400">{{ t('preview.addFolderFilesDesc') }}</span>
          </span>
        </button>
        <button type="button" role="menuitem" @click="pick('recursive')"
          class="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/80 cursor-pointer">
          <FolderTree class="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
          <span class="min-w-0">
            <span class="block text-control font-medium text-slate-800 dark:text-slate-100">{{ t('preview.addFolderRecursive') }}</span>
            <span class="block text-caption text-slate-500 dark:text-slate-400">{{ t('preview.addFolderRecursiveDesc') }}</span>
          </span>
        </button>
        <div class="my-1 border-t border-slate-200 dark:border-slate-700"></div>
        <button type="button" role="menuitem" @click="pick('folder')"
          class="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/80 cursor-pointer">
          <FolderPen class="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <span class="min-w-0">
            <span class="block text-control font-medium text-slate-800 dark:text-slate-100">{{ t('preview.addFolderItself') }}</span>
            <span class="block text-caption text-slate-500 dark:text-slate-400">{{ t('preview.addFolderItselfDesc') }}</span>
          </span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
