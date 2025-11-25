<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useOperationStore } from '../stores/operationStore'
import HelpModal from './HelpModal.vue'

const operationStore = useOperationStore()
const showHelp = ref(false)

onMounted(() => {
  const hasSeenHelp = localStorage.getItem('has-seen-help')
  if (!hasSeenHelp) {
    showHelp.value = true
  }
})

watch(showHelp, (newValue) => {
  if (!newValue) {
    // When closed, mark as seen
    localStorage.setItem('has-seen-help', 'true')
  }
})

function addRegexOperation() {
  operationStore.addOperation('regex', { pattern: '', replacement: '', useRegex: true })
}

// We are merging numbering into regex replacement, so we might not need a separate button for it,
// but the user might still want a quick way to add a "Replace" block.
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
        <span class="w-1 h-5 bg-blue-500 rounded-full"></span>
        操作流程
        <button @click="showHelp = true"
          class="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors" title="使用說明與 Regex 教學">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clip-rule="evenodd" />
          </svg>
        </button>
      </h2>
      <button @click="addRegexOperation"
        class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1 shadow-sm">
        <span>+</span> 新增規則
      </button>
    </div>

    <div class="space-y-3">
      <div v-for="(op, index) in operationStore.operations" :key="op.id"
        class="bg-slate-200/50 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-300 dark:border-slate-700 rounded-xl p-4 shadow-sm transition-all hover:border-slate-400 dark:hover:border-slate-600 group">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-500">#{{ index + 1 }}</span>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
              {{ op.type === 'regex' ? '搜尋與取代' : '其他操作' }}
            </span>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button @click="operationStore.moveOperation(op.id, 'up')"
              class="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-700"
              title="上移">↑</button>
            <button @click="operationStore.moveOperation(op.id, 'down')"
              class="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-300 dark:hover:bg-slate-700"
              title="下移">↓</button>
            <button @click="operationStore.removeOperation(op.id)"
              class="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 rounded hover:bg-red-100 dark:hover:bg-red-900/30 ml-1"
              title="移除">×</button>
          </div>
        </div>

        <div v-if="op.type === 'regex'" class="space-y-3">
          <div class="space-y-1">
            <div class="flex justify-between items-center">
              <label class="text-xs text-slate-600 dark:text-slate-400 ml-1">尋找目標</label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="op.params.useRegex"
                  class="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                <span class="text-xs text-slate-500 dark:text-slate-400">使用正規表達式 (Regex)</span>
              </label>
            </div>
            <input v-model="op.params.pattern" type="text"
              :placeholder="op.params.useRegex ? '輸入 Regex 樣式...' : '輸入要尋找的文字...'"
              class="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono" />
          </div>
          <div class="space-y-1">
            <label class="text-xs text-slate-600 dark:text-slate-400 ml-1 flex justify-between">
              <span>取代為</span>
              <span class="text-xs text-blue-600 dark:text-blue-400/80" title="使用 ${n} 代表從 1 開始的序號，${n:03} 代表補零至3位數">ℹ️
                支援 ${n} 序號</span>
            </label>
            <input v-model="op.params.replacement" type="text" placeholder="輸入取代後的文字..."
              class="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all" />
          </div>
        </div>
      </div>

      <div v-if="operationStore.operations.length === 0"
        class="text-center py-8 text-slate-500 dark:text-slate-500 text-sm italic">
        尚未新增任何規則
      </div>
    </div>
    <HelpModal v-model="showHelp" />
  </div>
</template>
