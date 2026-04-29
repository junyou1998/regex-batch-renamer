<script setup lang="ts">
import { useFileStore } from '../stores/fileStore'
import { useToastStore } from '../stores/toastStore'
import { generateDiffHtml } from '../utils/diff'
import { computed, ref, watch, nextTick, onBeforeUnmount, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVirtualList } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { Check, CircleX, Clock, GripVertical, X } from 'lucide-vue-next'

const fileStore = useFileStore()
const toastStore = useToastStore()
const { t } = useI18n()

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
    return
  }

  stopAutoScroll()
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

onBeforeUnmount(() => {
  onPointerCancel()
  stopAutoScroll()
})
</script>

<template>
  <div
    class="flex flex-col h-full w-full min-w-0 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden shadow-sm">
    <div
      class="bg-slate-200/50 dark:bg-slate-900/50 px-4 py-3 border-b border-slate-300 dark:border-slate-700 flex justify-between items-center backdrop-blur-sm">
      <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ $t('preview.title', {
        n:
          fileStore.files.length
      }) }}</h3>
      <button v-if="fileStore.files.length > 0" @click="fileStore.clearFiles"
        class="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors cursor-pointer">
        {{ $t('preview.clear') }}
      </button>
    </div>

    <!-- Virtual List Header -->
    <div class="bg-slate-200/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700">
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
                :title="$t('operations.reorder')"
                @pointerdown.stop="startFileReorder($event, file.id)">
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

    <!-- Empty State -->
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="px-4 py-12 text-center text-slate-500 dark:text-slate-500 text-sm italic">
        {{ $t('preview.empty') }}
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
