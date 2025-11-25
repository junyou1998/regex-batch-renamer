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

                <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all"
                    role="dialog" aria-modal="true">
                    <!-- Header -->
                    <div
                        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                        <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <span class="text-2xl">📖</span> 使用說明與 Regex 教學
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
                    <div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                        <!-- Basic Usage -->
                        <section class="space-y-3">
                            <h4 class="text-base font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                基本操作流程
                            </h4>
                            <ol
                                class="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300 ml-2">
                                <li>將檔案拖曳至左上角區塊，或點擊選擇檔案。</li>
                                <li>在「操作流程」中新增規則。</li>
                                <li>設定「尋找目標」與「取代為」的內容。</li>
                                <li>右側列表會即時預覽更名結果。</li>
                                <li>確認無誤後，點擊「執行重命名」或「複製到...」。</li>
                            </ol>
                        </section>

                        <hr class="border-slate-200 dark:border-slate-800">

                        <!-- Regex Tutorial -->
                        <section class="space-y-4">
                            <div class="flex items-center justify-between">
                                <h4
                                    class="text-base font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                    正規表達式 (Regex) 速查
                                </h4>
                                <span
                                    class="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">進階技巧</span>
                            </div>

                            <p class="text-sm text-slate-500 dark:text-slate-400">
                                正規表達式是一種強大的文字比對工具，可以幫助您精確地選取想要修改的文字部分。
                            </p>

                            <!-- Common Symbols Table -->
                            <div class="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                <table class="w-full text-sm text-left">
                                    <thead
                                        class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                        <tr>
                                            <th
                                                class="px-4 py-2 border-b border-r border-slate-200 dark:border-slate-700 w-24">
                                                符號</th>
                                            <th class="px-4 py-2 border-b border-slate-200 dark:border-slate-700">說明
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900/50">
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                .</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">匹配任意單一字元</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                \d</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">匹配數字 (0-9)</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                \w</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">匹配字母、數字或底線</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                \s</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">匹配空白字元 (空白鍵、Tab)
                                            </td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                *</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">前面的字元出現 0 次或多次</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                +</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">前面的字元出現 1 次或多次</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                ^</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">匹配字串開頭</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                $</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">匹配字串結尾</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Examples -->
                            <div class="space-y-3">
                                <h5 class="text-sm font-bold text-slate-700 dark:text-slate-300">實用範例</h5>

                                <div class="grid gap-3">
                                    <!-- Example 1 -->
                                    <div
                                        class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div class="text-xs font-semibold text-slate-500 mb-1">刪除所有空白</div>
                                        <div class="flex items-center gap-2 text-sm font-mono">
                                            <span
                                                class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-pink-600 dark:text-pink-400">\s+</span>
                                            <span class="text-slate-400">→</span>
                                            <span class="text-slate-400 italic">(留空)</span>
                                        </div>
                                    </div>

                                    <!-- Example 2 -->
                                    <div
                                        class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div class="text-xs font-semibold text-slate-500 mb-1">統一日期格式 (20231125 →
                                            2023-11-25)</div>
                                        <div class="flex flex-col gap-1">
                                            <div class="flex items-center gap-2 text-sm font-mono">
                                                <span class="text-slate-500 w-12">尋找:</span>
                                                <span
                                                    class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-pink-600 dark:text-pink-400">(\d{4})(\d{2})(\d{2})</span>
                                            </div>
                                            <div class="flex items-center gap-2 text-sm font-mono">
                                                <span class="text-slate-500 w-12">取代:</span>
                                                <span
                                                    class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-green-600 dark:text-green-400">$1-$2-$3</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Example 3 -->
                                    <div
                                        class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div class="text-xs font-semibold text-slate-500 mb-1">刪除括號及內容 (例如 "File
                                            (copy).txt" → "File.txt")</div>
                                        <div class="flex items-center gap-2 text-sm font-mono">
                                            <span
                                                class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-pink-600 dark:text-pink-400">\s*\([^)]*\)</span>
                                            <span class="text-slate-400">→</span>
                                            <span class="text-slate-400 italic">(留空)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <hr class="border-slate-200 dark:border-slate-800">

                            <!-- Numbering Guide -->
                            <section class="space-y-3">
                                <h4
                                    class="text-base font-bold text-green-600 dark:text-green-400 flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                    流水號功能 (${n})
                                </h4>
                                <p class="text-sm text-slate-500 dark:text-slate-400">
                                    您可以在「取代為」欄位中使用 <code
                                        class="bg-slate-100 dark:bg-slate-800 px-1 rounded font-mono text-slate-700 dark:text-slate-300">${n}</code>
                                    來插入遞增的數字。
                                </p>

                                <div class="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <table class="w-full text-sm text-left">
                                        <thead
                                            class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                            <tr>
                                                <th
                                                    class="px-4 py-2 border-b border-r border-slate-200 dark:border-slate-700 w-32">
                                                    語法</th>
                                                <th class="px-4 py-2 border-b border-slate-200 dark:border-slate-700">說明
                                                </th>
                                                <th class="px-4 py-2 border-b border-slate-200 dark:border-slate-700">範例
                                                    (第 5 個檔案)</th>
                                            </tr>
                                        </thead>
                                        <tbody
                                            class="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900/50">
                                            <tr>
                                                <td
                                                    class="px-4 py-2 font-mono text-green-600 dark:text-green-400 border-r border-slate-200 dark:border-slate-700">
                                                    ${n}</td>
                                                <td class="px-4 py-2 text-slate-600 dark:text-slate-400">插入序號 (從 1 開始)
                                                </td>
                                                <td class="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">5
                                                </td>
                                            </tr>
                                            <tr>
                                                <td
                                                    class="px-4 py-2 font-mono text-green-600 dark:text-green-400 border-r border-slate-200 dark:border-slate-700">
                                                    ${n:03}</td>
                                                <td class="px-4 py-2 text-slate-600 dark:text-slate-400">補零至指定位數 (例如 3
                                                    位)</td>
                                                <td class="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">005
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div
                                    class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div class="text-xs font-semibold text-slate-500 mb-1">範例：重新命名為 Image_001,
                                        Image_002...</div>
                                    <div class="flex flex-col gap-1">
                                        <div class="flex items-center gap-2 text-sm font-mono">
                                            <span class="text-slate-500 w-12">尋找:</span>
                                            <span
                                                class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-pink-600 dark:text-pink-400">.*</span>
                                            <span class="text-xs text-slate-400">(選取全部檔名)</span>
                                        </div>
                                        <div class="flex items-center gap-2 text-sm font-mono">
                                            <span class="text-slate-500 w-12">取代:</span>
                                            <span
                                                class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-green-600 dark:text-green-400">Image_${n:03}</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </section>
                    </div>

                    <!-- Footer -->
                    <div
                        class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
                        <button @click="$emit('update:modelValue', false)"
                            class="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors">
                            關閉
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
