<script setup lang="ts">
defineProps<{
    modelValue: boolean
}>()

defineEmits<{
    (e: 'update:modelValue', value: boolean): void
}>()
</script>

<template>
    <Teleport to="body">
        <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
            enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100" leave-to-class="opacity-0">
            <div v-if="modelValue"
                class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                @click.self="$emit('update:modelValue', false)">

                <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all"
                    role="dialog" aria-modal="true">
                    <!-- Header -->
                    <div
                        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <!-- <span class="text-2xl">ℹ️</span> -->
                            關於本專案
                        </h3>
                        <button @click="$emit('update:modelValue', false)"
                            class="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20"
                                fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    <!-- Content -->
                    <div class="p-6 space-y-6">

                        <!-- Project Info -->
                        <div class="text-center space-y-2">
                            <img src="/icon.png" alt="App Icon" class="w-24 h-24 mx-auto mb-4" />
                            <h4 class="text-xl font-bold text-slate-800 dark:text-white">Regex Batch Renamer</h4>
                            <p class="text-sm text-slate-500 dark:text-slate-400">
                                一個簡單、強大且開源的跨平台批次更名工具，支援 Windows、macOS 與 Linux。
                            </p>
                        </div>

                        <hr class="border-slate-200 dark:border-slate-800">

                        <!-- Developer Info -->
                        <div class="space-y-3">
                            <h5 class="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <span class="text-lg">👨‍💻</span> 開發者資訊
                            </h5>
                            <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                嗨！我是 Junyou。這個專案是為了讓繁瑣的檔案更名工作變得更簡單。如果您覺得這個工具對您有幫助，歡迎贊助我一杯咖啡，這將成為我持續開發與維護的動力！
                            </p>
                        </div>

                        <!-- Donation Button -->
                        <div class="pt-2 flex flex-col items-center">
                            <a href="https://www.buymeacoffee.com/junyou" target="_blank" rel="noopener noreferrer"
                                class="transition-transform hover:scale-105 active:scale-95">
                                <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                                    alt="Buy Me A Coffee" style="height: 60px !important; width: 217px !important;">
                            </a>
                            <p class="text-xs text-center text-slate-400 dark:text-slate-500 mt-3">
                                感謝您的支持與鼓勵 ❤️
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
