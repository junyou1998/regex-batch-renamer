<script setup lang="ts">
import { useToastStore } from '../stores/toastStore'
import { CircleCheck, CircleX, Info } from 'lucide-vue-next'

const toastStore = useToastStore()
</script>

<template>
    <Teleport to="body">
        <div class="fixed bottom-4 right-4 z-99999 flex flex-col gap-2 pointer-events-none">
            <TransitionGroup enter-active-class="transition duration-300 ease-out"
                enter-from-class="transform translate-y-2 opacity-0"
                enter-to-class="transform translate-y-0 opacity-100"
                leave-active-class="transition duration-200 ease-in"
                leave-from-class="transform translate-y-0 opacity-100"
                leave-to-class="transform translate-y-2 opacity-0">
                <div v-for="toast in toastStore.toasts" :key="toast.id"
                    class="pointer-events-auto px-4 py-3 rounded-lg shadow-lg border flex items-center gap-2 min-w-50"
                    :class="{
                        'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200': toast.type === 'info',
                        'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200': toast.type === 'success',
                        'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200': toast.type === 'error'
                    }">
                    <!-- Icons -->
                    <span v-if="toast.type === 'success'" class="text-green-500 dark:text-green-400">
                        <CircleCheck class="h-5 w-5" />
                    </span>
                    <span v-else-if="toast.type === 'error'" class="text-red-500 dark:text-red-400">
                        <CircleX class="h-5 w-5" />
                    </span>
                    <span v-else class="text-blue-500 dark:text-blue-400">
                        <Info class="h-5 w-5" />
                    </span>

                    <span class="text-sm font-medium flex-1">{{ toast.message }}</span>

                    <button v-if="toast.action" @click="toast.action.onClick"
                        class="ml-2 px-3 py-1 text-xs font-bold text-white bg-slate-900/20 hover:bg-slate-900/30 dark:bg-white/10 dark:hover:bg-white/20 rounded transition-colors cursor-pointer whitespace-nowrap">
                        {{ toast.action.label }}
                    </button>
                </div>
            </TransitionGroup>
        </div>
    </Teleport>
</template>
