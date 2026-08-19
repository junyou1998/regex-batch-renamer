<script setup lang="ts">
import { useFileStore } from '../stores/fileStore'
import { useToastStore } from '../stores/toastStore'
import { generateDiffHtml } from '../utils/diff'
import { computed, ref, watch, nextTick, onMounted, onUnmounted, onBeforeUnmount, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVirtualList } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { desktop } from '../services/desktop'
import { Check, CircleX, Clock, FilePlus, FolderPlus, GripVertical, Trash2, X } from 'lucide-vue-next'

const fileStore = useFileStore()
const toastStore = useToastStore()
const { t } = useI18n()

defineProps<{
  isFileDragActive?: boolean
}>()

const isLocalDragging = ref(false)
let dragCounter = 0

function onWindowDragEnter(e: DragEvent) {
  if (e.dataTransfer?.types?.includes('Files')) {
    dragCounter++
    isLocalDragging.value = true
  }
}

function onWindowDragLeave() {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    isLocalDragging.value = false
  }
}

function onWindowDrop(e: DragEvent) {
  dragCounter = 0
  isLocalDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const paths = Array.from(files)
      .map(file => (file as any).path)
      .filter((path): path is string => Boolean(path))
    if (paths.length > 0) {
      addFiles(paths)
    }
  }
}

function addFiles(paths: string[]) {
  fileStore.addFilePaths(paths)
}

function onDrop(e: DragEvent) {
  isLocalDragging.value = false
  dragCounter = 0
  const files = e.dataTransfer?.files
  if (files) {
    const paths = Array.from(files)
      .map(file => file.path)
      .filter((path): path is string => Boolean(path))
    addFiles(paths)
  }
}

function onDragOver() {
  isLocalDragging.value = true
}

function onDragLeave() {
  isLocalDragging.value = false
}

async function openFileDialog() {
  try {
    const paths = await desktop.selectFiles()
    addFiles(paths)
  } catch (error) {
    console.error('Failed to select files:', error)
    toastStore.addToast(t('dropZone.openFailed'), 'error')
  }
}

async function openDirectoryDialog() {
  try {
    const dir = await desktop.selectDirectory?.()
    if (dir) {
      addFiles([dir])
    }
  } catch (error) {
    console.error('Failed to select directory:', error)
    toastStore.addToast(t('errors.selectDirectoryFailed'), 'error')
  }
}

const ROW_HEIGHT = 44

const { files } = storeToRefs(fileStore)

const { list: virtualList, containerProps, wrapperProps, scrollTo } = useVirtualList(
  files,
  {
    itemHeight: ROW_HEIGHT,
  }
)
const virtualContainerRef = containerProps.ref as Ref<HTMLElement | null>

watch(() => fileStore.files.length, () => {
  scrollTo(0)
})

const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  content: '',
  isHtml: false
})
const tooltipRef = ref<HTMLElement | null>(null)

async function showTooltip(event: MouseEvent, content: string, isHtml = false) {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()

  let x = rect.left
  let y = rect.bottom + 5

  tooltip.value = {
    visible: true,
    x,
    y,
    content,
    isHtml
  }

  await nextTick()

  if (tooltipRef.value) {
    const tooltipRect = tooltipRef.value.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (x + tooltipRect.width > viewportWidth - 20) {
      x = viewportWidth - tooltipRect.width - 20
    }

    if (y + tooltipRect.height > viewportHeight - 20) {
      y = rect.top - tooltipRect.height - 5
    }

    if (x < 20) {
      x = 20
    }

    tooltip.value.x = x
    tooltip.value.y = y
  }
}

function hideTooltip() {
  tooltip.value.visible = false
}

function removeFile(id: string) {
  fileStore.removeFile(id)
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toastStore.addToast(t('preview.copied', { text }), 'success')
  } catch (err) {
    console.error('Failed to copy:', err)
    toastStore.addToast(t('preview.copyFailed'), 'error')
  }
}

const draggedFileId = ref<string | null>(null)
const dragOverFileId = ref<string | null>(null)
const dragOverPosition = ref<'before' | 'after' | null>(null)
const dragPreview = ref({ visible: false, x: 0, y: 0 })
const draggedFile = computed(() => fileStore.files.find(file => file.id === draggedFileId.value))

const AUTO_SCROLL_EDGE_THRESHOLD = 32
const AUTO_SCROLL_STEP = 16
const AUTO_SCROLL_INTERVAL = 16

const autoScrollDirection = ref<-1 | 1 | 0>(0)
let autoScrollTimer: ReturnType<typeof setInterval> | null = null

function getFileIndexById(id: string) {
  return fileStore.files.findIndex(file => file.id === id)
}

function stopAutoScroll() {
  autoScrollDirection.value = 0
  if (autoScrollTimer) {
    clearInterval(autoScrollTimer)
    autoScrollTimer = null
  }
}

function startAutoScroll(direction: -1 | 1) {
  if (autoScrollDirection.value === direction && autoScrollTimer) return

  stopAutoScroll()
  autoScrollDirection.value = direction
  autoScrollTimer = setInterval(() => {
    const container = virtualContainerRef.value
    if (!container || !draggedFileId.value) {
      stopAutoScroll()
      return
    }
    container.scrollTop += AUTO_SCROLL_STEP * direction
  }, AUTO_SCROLL_INTERVAL)
}

function handleAutoScroll(clientY: number) {
  const container = virtualContainerRef.value
  if (!container || !draggedFileId.value) return

  const { top, bottom } = container.getBoundingClientRect()
  if (clientY <= top + AUTO_SCROLL_EDGE_THRESHOLD) {
    startAutoScroll(-1)
    return
  }

  if (clientY >= bottom - AUTO_SCROLL_EDGE_THRESHOLD) {
    startAutoScroll(1)
  } else {
    stopAutoScroll()
  }
}

function getDropTarget(clientX: number, clientY: number) {
  const container = virtualContainerRef.value
  if (!container) return null

  const hit = document.elementFromPoint(clientX, clientY)
  const row = hit instanceof HTMLElement
    ? hit.closest<HTMLElement>('[data-file-id]')
    : null

  if (row && container.contains(row)) {
    const id = row.dataset.fileId
    if (!id || id === draggedFileId.value) return null
    const rect = row.getBoundingClientRect()
    return {
      id,
      position: clientY < rect.top + rect.height / 2 ? 'before' as const : 'after' as const,
    }
  }

  const visibleRows = Array.from(container.querySelectorAll<HTMLElement>('[data-file-id]'))
    .filter(rowEl => rowEl.dataset.fileId !== draggedFileId.value)

  const first = visibleRows.at(0)
  const last = visibleRows.at(-1)
  if (first && clientY < first.getBoundingClientRect().top) {
    return { id: first.dataset.fileId || '', position: 'before' as const }
  }
  if (last && clientY > last.getBoundingClientRect().bottom) {
    return { id: last.dataset.fileId || '', position: 'after' as const }
  }

  return null
}

function updateDropTarget(clientX: number, clientY: number) {
  const target = getDropTarget(clientX, clientY)
  dragOverFileId.value = target?.id || null
  dragOverPosition.value = target?.position || null
}

function startFileReorder(event: PointerEvent, fileId: string) {
  if (event.button !== 0) return
  event.preventDefault()
  draggedFileId.value = fileId
  dragPreview.value = { visible: true, x: event.clientX, y: event.clientY }
  updateDropTarget(event.clientX, event.clientY)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}

function onPointerMove(event: PointerEvent) {
  if (!draggedFileId.value) return
  event.preventDefault()
  dragPreview.value = { visible: true, x: event.clientX, y: event.clientY }
  handleAutoScroll(event.clientY)
  updateDropTarget(event.clientX, event.clientY)
}

function onPointerUp() {
  if (draggedFileId.value && dragOverFileId.value && dragOverPosition.value) {
    const fromIndex = getFileIndexById(draggedFileId.value)
    const targetIndex = getFileIndexById(dragOverFileId.value)
    if (fromIndex !== -1 && targetIndex !== -1) {
      let insertIndex = targetIndex + (dragOverPosition.value === 'after' ? 1 : 0)
      if (fromIndex < insertIndex) {
        insertIndex -= 1
      }
      insertIndex = Math.max(0, Math.min(fileStore.files.length - 1, insertIndex))
      fileStore.reorderFiles(fromIndex, insertIndex)
    }
  }
  onPointerCancel()
}

function onPointerCancel() {
  draggedFileId.value = null
  dragOverFileId.value = null
  dragOverPosition.value = null
  dragPreview.value = { visible: false, x: 0, y: 0 }
  stopAutoScroll()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}

onMounted(() => {
  window.addEventListener('dragenter', onWindowDragEnter)
  window.addEventListener('dragleave', onWindowDragLeave)
  window.addEventListener('dragover', (e) => e.preventDefault())
  window.addEventListener('drop', onWindowDrop)
})

onUnmounted(() => {
  window.removeEventListener('dragenter', onWindowDragEnter)
  window.removeEventListener('dragleave', onWindowDragLeave)
  window.removeEventListener('drop', onWindowDrop)
})

onBeforeUnmount(() => {
  onPointerCancel()
  stopAutoScroll()
})
</script>

<template>
  <div @drop.prevent="onDrop" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave"
    class="relative flex flex-col h-full w-full min-w-0 bg-slate-100 dark:bg-slate-800/50 rounded-xl border transition-all duration-200 overflow-hidden shadow-sm"
    :class="[
      (isLocalDragging || isFileDragActive) && fileStore.files.length > 0
        ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-[0_0_24px_rgba(59,130,246,0.16)]'
        : 'border-slate-300 dark:border-slate-700'
    ]">
    <!-- Floating Clean Drag Indicator Pill (No blur mask, no center card) -->
    <Transition enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2 scale-95" enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-all duration-150 ease-in" leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-2 scale-95">
      <div v-if="(isLocalDragging || isFileDragActive) && fileStore.files.length > 0"
        class="absolute top-12 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <div
          class="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600/95 dark:bg-blue-500/95 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40 text-xs font-semibold backdrop-blur-md select-none">
          <FolderPlus class="w-4 h-4" />
          <span>{{ $t('preview.dragActiveTitle') }}</span>
        </div>
      </div>
    </Transition>

    <!-- Top Action Bar -->
    <div
      class="bg-slate-200/60 dark:bg-slate-900/60 px-4 py-2.5 border-b border-slate-300 dark:border-slate-700 flex justify-between items-center backdrop-blur-sm shrink-0">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {{ $t('preview.title', { n: fileStore.files.length }) }}
        </h3>
      </div>
      <div v-if="fileStore.files.length > 0" class="flex items-center gap-2">
        <button @click="openFileDialog"
          class="inline-flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 shadow-2xs transition-colors cursor-pointer">
          <FilePlus class="w-3.5 h-3.5 text-blue-500" />
          <span>{{ $t('preview.addFiles') }}</span>
        </button>
        <button @click="openDirectoryDialog"
          class="inline-flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-600 shadow-2xs transition-colors cursor-pointer">
          <FolderPlus class="w-3.5 h-3.5 text-blue-500" />
          <span>{{ $t('preview.addFolder') }}</span>
        </button>
        <button @click="fileStore.clearFiles"
          class="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2.5 py-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors cursor-pointer">
          <Trash2 class="w-3.5 h-3.5" />
          <span>{{ $t('preview.clear') }}</span>
        </button>
      </div>
    </div>

    <!-- Virtual List Header (Shown when files exist) -->
    <div v-if="fileStore.files.length > 0"
      class="bg-slate-200/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shrink-0">
      <div class="file-list-row">
        <div class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 text-center">#</div>
        <div class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 truncate">{{ $t('preview.original')
          }}</div>
        <div class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 truncate">{{ $t('preview.new') }}
        </div>
        <div class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 text-center">{{
          $t('preview.status') }}</div>
        <div class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-500"></div>
      </div>
    </div>

    <!-- Virtual List Container -->
    <div v-if="fileStore.files.length > 0" v-bind="containerProps" class="flex-1 overflow-auto custom-scrollbar w-full">
      <div v-bind="wrapperProps" class="w-full">
        <div v-for="{ data: file, index: virtualIndex } in virtualList" :key="file.id" :data-file-id="file.id"
          :style="{ height: ROW_HEIGHT + 'px' }" :class="[
            'file-list-row items-center transition-colors group',
            dragOverFileId === file.id && dragOverPosition === 'before' ? 'border-t-2 border-blue-500' : '',
            dragOverFileId === file.id && dragOverPosition === 'after' ? 'border-b-2 border-blue-500' : '',
            virtualIndex % 2 === 0
              ? 'bg-white dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              : 'bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50',
            draggedFileId === file.id ? 'opacity-60 ring-1 ring-blue-400 bg-blue-50 dark:bg-blue-950/30' : ''
          ]">
          <!-- Index Column -->
          <div class="px-4 py-2 text-xs text-slate-500 dark:text-slate-500 text-center font-mono">
            <div class="flex items-center justify-center">
              <span class="group-hover:hidden">{{ virtualIndex + 1 }}</span>
              <button type="button"
                class="hidden group-hover:flex text-slate-400 cursor-grab active:cursor-grabbing touch-none"
                :title="$t('operations.reorder')" @pointerdown.stop="startFileReorder($event, file.id)">
                <GripVertical class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Original Name Column -->
          <div
            class="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 overflow-hidden cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
            @click="copyToClipboard(file.originalName)"
            @mouseenter="(e) => showTooltip(e, $t('preview.clickToCopy', { text: file.originalName }))"
            @mouseleave="hideTooltip">
            <div class="truncate" :title="file.originalName">
              {{ file.originalName }}
            </div>
          </div>

          <!-- New Name Column (with diff) -->
          <div class="px-4 py-2 text-sm text-slate-800 dark:text-slate-200 overflow-hidden"
            @mouseenter="(e) => showTooltip(e, file.newName)" @mouseleave="hideTooltip">
            <div class="truncate" v-html="generateDiffHtml(file.originalName, file.newName)"></div>
          </div>

          <!-- Status Column -->
          <div class="px-4 py-2 text-center">
            <Check v-if="file.status === 'success'" class="inline-block w-4 h-4 text-green-500" title="成功" />
            <CircleX v-else-if="file.status === 'error'" class="inline-block w-4 h-4 text-red-500"
              :title="file.errorMessage" />
            <span v-else-if="file.originalName !== file.newName"
              class="inline-flex items-center justify-center w-5 h-5 text-amber-500" title="待處理">
              <Clock class="w-4 h-4" />
            </span>
          </div>

          <!-- Remove Button Column -->
          <div class="px-4 py-2 text-center">
            <button @click="removeFile(file.id)"
              class="text-slate-500 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              :title="$t('preview.remove')">
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State / Clean Minimalist DropZone -->
    <div v-else @drop.prevent="onDrop" @dragover.prevent="onDragOver" @dragleave.prevent="onDragLeave"
      class="flex-1 flex flex-col items-center justify-center p-8 transition-colors select-none" :class="[
        isLocalDragging || isFileDragActive
          ? 'bg-blue-500/10'
          : ''
      ]">
      <div class="flex flex-col items-center max-w-sm text-center">
        <!-- Gorgeous Vector SVG Folder with Gentle Float & Layer Animation -->
        <div class="relative w-28 h-28 mb-4 flex items-center justify-center group/folder">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"
            class="w-28 h-28 transition-all duration-300 drop-shadow-sm group-hover/folder:scale-105"
            :class="{ 'scale-110 drop-shadow-md': isLocalDragging || isFileDragActive }">
            <defs>
              <linearGradient id="folderBack" x1="8" y1="12" x2="56" y2="52" gradientUnits="userSpaceOnUse">
                <stop stop-color="#3B82F6" />
                <stop offset="1" stop-color="#1D4ED8" />
              </linearGradient>
              <linearGradient id="folderFront" x1="6" y1="22" x2="58" y2="54" gradientUnits="userSpaceOnUse">
                <stop stop-color="#60A5FA" />
                <stop offset="1" stop-color="#2563EB" />
              </linearGradient>
              <linearGradient id="folderPaper" x1="16" y1="16" x2="48" y2="44" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FFFFFF" />
                <stop offset="1" stop-color="#F1F5F9" />
              </linearGradient>
            </defs>
            <!-- Folder Back & Tab -->
            <path
              d="M8 18C8 15.7909 9.79086 14 12 14H24.5C26.0913 14 27.6174 14.6321 28.7426 15.7574L31.5 18.5147C32.0626 19.0774 32.8257 19.3934 33.6213 19.3934H52C54.2091 19.3934 56 21.1843 56 23.3934V46C56 48.2091 54.2091 50 52 50H12C9.79086 50 8 48.2091 8 46V18Z"
              fill="url(#folderBack)" />

            <!-- Paper Sheet (Pops up gently on hover or drag active) -->
            <rect x="15" y="16" width="34" height="26" rx="2.5" fill="url(#folderPaper)"
              class="transition-transform duration-300 origin-bottom"
              :class="isLocalDragging || isFileDragActive ? '-translate-y-2' : 'group-hover/folder:-translate-y-1.5'" />
            <line x1="20" y1="22" x2="36" y2="22" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"
              class="transition-transform duration-300"
              :class="isLocalDragging || isFileDragActive ? '-translate-y-2' : 'group-hover/folder:-translate-y-1.5'" />
            <line x1="20" y1="27" x2="44" y2="27" stroke="#CBD5E1" stroke-width="1.5" stroke-linecap="round"
              class="transition-transform duration-300"
              :class="isLocalDragging || isFileDragActive ? '-translate-y-2' : 'group-hover/folder:-translate-y-1.5'" />
            <line x1="20" y1="32" x2="40" y2="32" stroke="#CBD5E1" stroke-width="1.5" stroke-linecap="round"
              class="transition-transform duration-300"
              :class="isLocalDragging || isFileDragActive ? '-translate-y-2' : 'group-hover/folder:-translate-y-1.5'" />

            <!-- Folder Front Cover (Opens on hover / drag active) -->
            <path
              d="M6 26C6 23.7909 7.79086 22 10 22H54C56.2091 22 58 23.7909 58 26L55.5 48C55.5 50.2091 53.7091 52 51.5 52H12.5C10.2909 52 8.5 50.2091 8.5 48L6 26Z"
              fill="url(#folderFront)" class="transition-transform duration-300 origin-bottom"
              :class="isLocalDragging || isFileDragActive ? 'scale-y-90 translate-y-1' : 'group-hover/folder:scale-y-95'" />
          </svg>
        </div>
        <p class="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {{ $t('dropZone.text') }} <span @click="openFileDialog"
            class="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-semibold">{{
              $t('dropZone.action') }}</span>
        </p>
        <p class="text-xs text-slate-500 dark:text-slate-400 mb-5">{{ $t('dropZone.supports') }}</p>

        <div class="flex items-center gap-2.5">
          <button @click="openFileDialog"
            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors cursor-pointer">
            <FilePlus class="w-3.5 h-3.5" />
            <span>{{ $t('preview.addFiles') }}</span>
          </button>
          <button @click="openDirectoryDialog"
            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors cursor-pointer">
            <FolderPlus class="w-3.5 h-3.5" />
            <span>{{ $t('preview.addFolder') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Teleported Tooltip -->
    <Teleport to="body">
      <div v-if="dragPreview.visible && draggedFile"
        class="fixed z-[100000] pointer-events-none max-w-sm rounded-lg border border-blue-300 dark:border-blue-500 bg-white/95 dark:bg-slate-900/95 px-3 py-2 shadow-xl ring-1 ring-blue-500/20"
        :style="{ left: `${dragPreview.x + 14}px`, top: `${dragPreview.y + 14}px` }">
        <div class="text-xs font-semibold text-blue-600 dark:text-blue-300">#{{ getFileIndexById(draggedFile.id) + 1
        }}</div>
        <div class="truncate text-sm text-slate-800 dark:text-slate-100">{{ draggedFile.originalName }}</div>
      </div>
      <div v-show="tooltip.visible" ref="tooltipRef"
        class="fixed z-9999 bg-slate-800 dark:bg-slate-900 text-slate-200 dark:text-slate-200 px-3 py-2 rounded-lg shadow-xl text-xs border border-slate-600 dark:border-slate-700 pointer-events-none whitespace-nowrap"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
        <span v-if="!tooltip.isHtml">{{ tooltip.content }}</span>
        <span v-else v-html="tooltip.content"></span>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(51, 65, 85, 0.5);
  border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(71, 85, 105, 0.8);
}

/* Force fixed table-like layout for file list */
.file-list-row {
  display: grid;
  grid-template-columns: 48px 1fr 1fr 64px 40px;
  width: 100%;
}
</style>
