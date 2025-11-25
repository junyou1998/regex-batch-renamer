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
                            <span class="text-2xl">📖</span> {{ $t('help.title') }}
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
                                {{ $t('help.basic.title') }}
                            </h4>
                            <ol
                                class="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300 ml-2">
                                <li>{{ $t('help.basic.step1') }}</li>
                                <li>{{ $t('help.basic.step2') }}</li>
                                <li>{{ $t('help.basic.step3') }}</li>
                                <li>{{ $t('help.basic.step4') }}</li>
                                <li>{{ $t('help.basic.step5') }}</li>
                            </ol>
                        </section>

                        <hr class="border-slate-200 dark:border-slate-800">

                        <!-- Regex Tutorial -->
                        <section class="space-y-4">
                            <div class="flex items-center justify-between">
                                <h4
                                    class="text-base font-bold text-purple-600 dark:text-purple-400 flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                    {{ $t('help.regex.title') }}
                                </h4>
                                <span
                                    class="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">{{
                                    $t('help.regex.advanced') }}</span>
                            </div>

                            <p class="text-sm text-slate-500 dark:text-slate-400">
                                {{ $t('help.regex.description') }}
                            </p>

                            <!-- Common Symbols Table -->
                            <div class="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                <table class="w-full text-sm text-left">
                                    <thead
                                        class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                        <tr>
                                            <th
                                                class="px-4 py-2 border-b border-r border-slate-200 dark:border-slate-700 w-24">
                                                {{ $t('help.regex.table.symbol') }}</th>
                                            <th class="px-4 py-2 border-b border-slate-200 dark:border-slate-700">{{
                                                $t('help.regex.table.desc') }}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody
                                        class="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900/50">
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                .</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.dot') }}</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                \d</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.digit') }}</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                \w</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.word') }}</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                \s</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.space') }}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                *</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.star') }}</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                +</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.plus') }}</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                ^</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.caret') }}</td>
                                        </tr>
                                        <tr>
                                            <td
                                                class="px-4 py-2 font-mono text-pink-600 dark:text-pink-400 border-r border-slate-200 dark:border-slate-700">
                                                $</td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.dollar') }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Examples -->
                            <div class="space-y-3">
                                <h5 class="text-sm font-bold text-slate-700 dark:text-slate-300">{{
                                    $t('help.regex.examples.title') }}</h5>

                                <div class="grid gap-3">
                                    <!-- Example 1 -->
                                    <div
                                        class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div class="text-xs font-semibold text-slate-500 mb-1">{{
                                            $t('help.regex.examples.ex1.title') }}</div>
                                        <div class="flex items-center gap-2 text-sm font-mono">
                                            <span
                                                class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-pink-600 dark:text-pink-400">\s+</span>
                                            <span class="text-slate-400">→</span>
                                            <span class="text-slate-400 italic">{{ $t('help.regex.examples.ex1.desc')
                                                }}</span>
                                        </div>
                                    </div>

                                    <!-- Example 2 -->
                                    <div
                                        class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div class="text-xs font-semibold text-slate-500 mb-1">{{
                                            $t('help.regex.examples.ex2.title') }}</div>
                                        <div class="flex flex-col gap-1">
                                            <div class="flex items-center gap-2 text-sm font-mono">
                                                <span class="text-slate-500 w-12">{{ $t('help.regex.examples.ex2.find')
                                                    }}</span>
                                                <span
                                                    class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-pink-600 dark:text-pink-400">(\d{4})(\d{2})(\d{2})</span>
                                            </div>
                                            <div class="flex items-center gap-2 text-sm font-mono">
                                                <span class="text-slate-500 w-12">{{
                                                    $t('help.regex.examples.ex2.replace') }}</span>
                                                <span
                                                    class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-green-600 dark:text-green-400">$1-$2-$3</span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Example 3 -->
                                    <div
                                        class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div class="text-xs font-semibold text-slate-500 mb-1">{{
                                            $t('help.regex.examples.ex3.title') }}</div>
                                        <div class="flex items-center gap-2 text-sm font-mono">
                                            <span
                                                class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-pink-600 dark:text-pink-400">\s*\([^)]*\)</span>
                                            <span class="text-slate-400">→</span>
                                            <span class="text-slate-400 italic">{{ $t('help.regex.examples.ex3.desc')
                                                }}</span>
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
                                    {{ $t('help.numbering.title') }}
                                </h4>
                                <p class="text-sm text-slate-500 dark:text-slate-400">
                                    <i18n-t keypath="help.numbering.description" tag="span">
                                        <template #code>
                                            <code
                                                class="bg-slate-100 dark:bg-slate-800 px-1 rounded font-mono text-slate-700 dark:text-slate-300">${n}</code>
                                        </template>
                                    </i18n-t>
                                </p>

                                <div class="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                    <table class="w-full text-sm text-left">
                                        <thead
                                            class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                                            <tr>
                                                <th
                                                    class="px-4 py-2 border-b border-r border-slate-200 dark:border-slate-700 w-32">
                                                    {{ $t('help.numbering.table.syntax') }}</th>
                                                <th class="px-4 py-2 border-b border-slate-200 dark:border-slate-700">{{
                                                    $t('help.numbering.table.desc')
                                                    }}
                                                </th>
                                                <th class="px-4 py-2 border-b border-slate-200 dark:border-slate-700">{{
                                                    $t('help.numbering.table.example') }}</th>
                                            </tr>
                                        </thead>
                                        <tbody
                                            class="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900/50">
                                            <tr>
                                                <td
                                                    class="px-4 py-2 font-mono text-green-600 dark:text-green-400 border-r border-slate-200 dark:border-slate-700">
                                                    ${n}</td>
                                                <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                    $t('help.numbering.table.n') }}
                                                </td>
                                                <td class="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">5
                                                </td>
                                            </tr>
                                            <tr>
                                                <td
                                                    class="px-4 py-2 font-mono text-green-600 dark:text-green-400 border-r border-slate-200 dark:border-slate-700">
                                                    ${n:03}</td>
                                                <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                    $t('help.numbering.table.nPad') }}</td>
                                                <td class="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">005
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div
                                    class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div class="text-xs font-semibold text-slate-500 mb-1">{{
                                        $t('help.numbering.example.title') }}</div>
                                    <div class="flex flex-col gap-1">
                                        <div class="flex items-center gap-2 text-sm font-mono">
                                            <span class="text-slate-500 w-12">{{ $t('help.numbering.example.find')
                                                }}</span>
                                            <span
                                                class="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 text-pink-600 dark:text-pink-400">.*</span>
                                            <span class="text-xs text-slate-400">{{
                                                $t('help.numbering.example.selectAll') }}</span>
                                        </div>
                                        <div class="flex items-center gap-2 text-sm font-mono">
                                            <span class="text-slate-500 w-12">{{ $t('help.numbering.example.replace')
                                                }}</span>
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
                            {{ $t('help.close') }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
