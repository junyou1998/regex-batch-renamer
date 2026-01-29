<script setup lang="ts">
import { useFileStore } from '../stores/fileStore'
import { useToastStore } from '../stores/toastStore'
import { generateDiffHtml } from '../utils/diff'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVirtualList } from '@vueuse/core'
import { storeToRefs } from 'pinia'

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

import { nextTick } from 'vue'

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

const draggedIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(event: DragEvent, index: number) {
  draggedIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.dropEffect = 'move'
  }
}

function onDragEnter(index: number) {
  if (draggedIndex.value !== null && draggedIndex.value !== index) {
    dragOverIndex.value = index
  }
}

function onDragEnd() {
  draggedIndex.value = null
  dragOverIndex.value = null
}

function onDrop(index: number) {
  if (draggedIndex.value !== null && draggedIndex.value !== index) {
    fileStore.reorderFiles(draggedIndex.value, index)
  }
  onDragEnd()
}
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
        <div v-for="{ data: file, index: virtualIndex } in virtualList" :key="file.id" draggable="true"
          @dragstart="onDragStart($event, virtualIndex)" @dragenter="onDragEnter(virtualIndex)" @dragover.prevent
          @drop="onDrop(virtualIndex)" @dragend="onDragEnd" :style="{ height: ROW_HEIGHT + 'px' }" :class="[
            'file-list-row items-center transition-colors group cursor-grab active:cursor-grabbing',
            dragOverIndex === virtualIndex ? 'border-t-2 border-blue-500' : '',
            virtualIndex % 2 === 0
              ? 'bg-white dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              : 'bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50',
            draggedIndex === virtualIndex ? 'opacity-50 bg-slate-200 dark:bg-slate-700' : ''
          ]">
          <!-- Index Column -->
          <div class="px-4 py-2 text-xs text-slate-500 dark:text-slate-500 text-center font-mono">
            <div class="flex items-center justify-center">
              <span class="group-hover:hidden">{{ virtualIndex + 1 }}</span>
              <span class="hidden group-hover:block text-slate-400 cursor-grab">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
                </svg>
              </span>
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
            <span v-if="file.status === 'success'" class="text-green-500 text-sm font-bold" title="成功">✓</span>
            <span v-else-if="file.status === 'error'" class="text-red-500 text-sm font-bold"
              :title="file.errorMessage">✗</span>
            <span v-else-if="file.originalName !== file.newName"
              class="inline-flex items-center justify-center w-5 h-5 text-amber-500" title="待處理">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clip-rule="evenodd" />
              </svg>
            </span>
          </div>

          <!-- Remove Button Column -->
          <div class="px-4 py-2 text-center">
            <button @click="removeFile(file.id)"
              class="text-slate-500 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
              :title="$t('preview.remove')">
              ×
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
