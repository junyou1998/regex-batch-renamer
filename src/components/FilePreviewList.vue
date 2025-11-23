<script setup lang="ts">
import { useFileStore } from '../stores/fileStore'
import { useToastStore } from '../stores/toastStore'
import { generateDiffHtml } from '../utils/diff'

import { useI18n } from 'vue-i18n'

const fileStore = useFileStore()
const toastStore = useToastStore()
const { t } = useI18n()

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
</script>

<template>
  <div
    class="flex flex-col h-full bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden shadow-sm">
    <div
      class="bg-slate-200/50 dark:bg-slate-900/50 px-4 py-3 border-b border-slate-300 dark:border-slate-700 flex justify-between items-center backdrop-blur-sm">
      <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ $t('preview.title', {
        n:
          fileStore.files.length }) }}</h3>
      <button v-if="fileStore.files.length > 0" @click="fileStore.clearFiles"
        class="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
        {{ $t('preview.clear') }}
      </button>
    </div>

    <div class="flex-1 overflow-auto custom-scrollbar">
      <table class="w-full text-left border-collapse table-fixed">
        <thead class="bg-slate-200/80 dark:bg-slate-900/80 sticky top-0 z-10 backdrop-blur-md">
          <tr>
            <th class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 w-12 text-center">#</th>
            <th class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-500">{{ $t('preview.original') }}
            </th>
            <th class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-500">{{ $t('preview.new') }}</th>
            <th class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 w-16 text-center">{{
              $t('preview.status') }}</th>
            <th class="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-500 w-10"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-700/50">
          <tr v-for="(file, index) in fileStore.files" :key="file.id" :class="[
            'transition-colors group',
            index % 2 === 0
              ? 'bg-white dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              : 'bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          ]">
            <td class="px-4 py-2 text-xs text-slate-500 dark:text-slate-500 text-center font-mono">{{ index + 1 }}</td>
            <td
              class="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 group relative max-w-0 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
              @click="copyToClipboard(file.originalName)">
              <div class="truncate" :title="file.originalName">
                {{ file.originalName }}
              </div>
              <!-- Tooltip on hover -->
              <div
                class="absolute left-0 top-full mt-1 bg-slate-800 dark:bg-slate-900 text-slate-200 dark:text-slate-200 px-3 py-2 rounded-lg shadow-xl z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap text-xs border border-slate-600 dark:border-slate-700">
                {{ $t('preview.clickToCopy', { text: file.originalName }) }}
              </div>
            </td>
            <td class="px-4 py-2 text-sm text-slate-800 dark:text-slate-200 group relative max-w-0">
              <!-- Diff View -->
              <div class="truncate" v-html="generateDiffHtml(file.originalName, file.newName)"></div>
              <!-- Tooltip on hover -->
              <div
                class="absolute left-0 top-full mt-1 bg-slate-800 dark:bg-slate-900 text-slate-200 dark:text-slate-200 px-3 py-2 rounded-lg shadow-xl z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap text-xs border border-slate-600 dark:border-slate-700">
                {{ file.newName }}
              </div>
            </td>
            <td class="px-4 py-2 text-center">
              <!-- Only show status if there's a pending change or error -->
              <span v-if="file.originalName !== file.newName && file.status === 'pending'"
                class="text-slate-500 text-xs">⏳</span>
              <span v-else-if="file.status === 'success'" class="text-green-400 text-xs">✓</span>
              <span v-else-if="file.status === 'error'" class="text-red-400 text-xs" :title="file.errorMessage">✗</span>
            </td>
            <td class="px-4 py-2 text-center">
              <button @click="removeFile(file.id)"
                class="text-slate-500 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                :title="$t('preview.remove')">
                ×
              </button>
            </td>
          </tr>
          <tr v-if="fileStore.files.length === 0">
            <td colspan="5" class="px-4 py-12 text-center text-slate-500 dark:text-slate-500 text-sm italic">
              {{ $t('preview.empty') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
</style>
