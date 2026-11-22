<script setup lang="ts">
import { BookOpenText, X } from 'lucide-vue-next'

import { modKey } from '../services/helpBus'
import CopyCode from './CopyCode.vue'
import { useAiStore } from '../stores/aiStore'
import { Sparkles, ShieldCheck } from 'lucide-vue-next'
import { useEscapeToClose } from '../composables/useEscapeToClose'

const shortcuts = [
    { label: 'help.shortcuts.rename', keys: [modKey, 'Enter'] },
    { label: 'help.shortcuts.undo', keys: [modKey, 'Z'] },
    { label: 'help.shortcuts.addFiles', keys: [modKey, 'O'] },
    { label: 'help.shortcuts.help', keys: [modKey, '/'] },
    { label: 'help.shortcuts.zoomIn', keys: [modKey, '+'] },
    { label: 'help.shortcuts.zoomOut', keys: [modKey, '−'] },
    { label: 'help.shortcuts.zoomReset', keys: [modKey, '0'] },
    { label: 'help.shortcuts.close', keys: ['Esc'] },
]

const props = defineProps<{
    modelValue: boolean
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void
}>()

useEscapeToClose(() => props.modelValue, () => emit('update:modelValue', false))

const aiStore = useAiStore()
const aiSteps = ['help.ai.step1', 'help.ai.step2', 'help.ai.step3', 'help.ai.step4']
const aiExamples = ['help.ai.example1', 'help.ai.example2', 'help.ai.example3']

function openAiPanel() {
    emit('update:modelValue', false)
    aiStore.openDrawer()
}

/** Send an example prompt; if the provider isn't set up yet, the panel shows how to set it up. */
function askAi(prompt: string) {
    openAiPanel()
    if (aiStore.status?.ready) void aiStore.sendMessage(prompt)
}
</script>

<template>
    <Teleport to="body">
        <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
            enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100" leave-to-class="opacity-0">
            <div v-if="modelValue"
                class="fixed inset-0 z-100 flex items-center justify-center p-4 pt-10 bg-slate-900/60 backdrop-blur-sm"
                @click.self="$emit('update:modelValue', false)">

                <!-- Top Titlebar Window Drag Region (Pass-through for macOS window dragging) -->
                <div data-tauri-drag-region class="absolute top-0 left-0 right-0 h-[38px] z-10 pointer-events-auto"></div>

                <div class="relative z-20 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all"
                    role="dialog" aria-modal="true">
                    <!-- Header -->
                    <div
                        data-tauri-drag-region
                        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 select-none shrink-0">
                        <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 no-drag">
                            <BookOpenText class="h-6 w-6" /> {{ $t('help.title') }}
                        </h3>

                        <!-- Middle Drag Area -->
                        <div data-tauri-drag-region class="flex-1 h-full min-w-4"></div>

                        <button @click="$emit('update:modelValue', false)"
                            class="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer no-drag">
                            <X class="h-5 w-5" />
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

                        <!-- Pipeline & Rule Ordering -->
                        <section class="space-y-3">
                            <h4 class="text-base font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                {{ $t('help.pipeline.title') }}
                            </h4>
                            <p class="text-sm text-slate-600 dark:text-slate-300">
                                {{ $t('help.pipeline.description') }}
                            </p>
                            <ul class="list-disc list-inside space-y-1.5 text-sm text-slate-600 dark:text-slate-300 ml-2">
                                <li>{{ $t('help.pipeline.point1') }}</li>
                                <li>{{ $t('help.pipeline.point2') }}</li>
                            </ul>
                            <div class="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/50 rounded-xl text-xs text-indigo-800 dark:text-indigo-300">
                                {{ $t('help.pipeline.tip') }}
                            </div>
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
                                            <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="." tone="pink" /></td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.dot') }}</td>
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="\d" tone="pink" /></td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.digit') }}</td>
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="\w" tone="pink" /></td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.word') }}</td>
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="\s" tone="pink" /></td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.space') }}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="*" tone="pink" /></td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.star') }}</td>
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="+" tone="pink" /></td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.plus') }}</td>
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="^" tone="pink" /></td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.caret') }}</td>
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="$" tone="pink" /></td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.dollar') }}</td>
                                        </tr>
                                        <tr>
                                            <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="^.*" tone="pink" /></td>
                                            <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                $t('help.regex.table.all') }}</td>
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
                                            <CopyCode code="\s+" tone="pink" />
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
                                                <CopyCode code="(\d{4})(\d{2})(\d{2})" tone="pink" />
                                            </div>
                                            <div class="flex items-center gap-2 text-sm font-mono">
                                                <span class="text-slate-500 w-12">{{
                                                    $t('help.regex.examples.ex2.replace') }}</span>
                                                <CopyCode code="$1-$2-$3" tone="green" />
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Example 3 -->
                                    <div
                                        class="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div class="text-xs font-semibold text-slate-500 mb-1">{{
                                            $t('help.regex.examples.ex3.title') }}</div>
                                        <div class="flex items-center gap-2 text-sm font-mono">
                                            <CopyCode code="\s*\([^)]*\)" tone="pink" />
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
                                                <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="${n}" tone="green" /></td>
                                                <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                    $t('help.numbering.table.n') }}
                                                </td>
                                                <td class="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">5
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="${n:03}" tone="green" /></td>
                                                <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                    $t('help.numbering.table.nPad') }}</td>
                                                <td class="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">005
                                                </td>
                                            </tr>
                                            <tr>
                                                <td class="px-4 py-2 border-r border-slate-200 dark:border-slate-700"><CopyCode code="${n:3:0}" tone="green" /></td>
                                                <td class="px-4 py-2 text-slate-600 dark:text-slate-400">{{
                                                    $t('help.numbering.table.nStart') }}</td>
                                                <td class="px-4 py-2 font-mono text-slate-600 dark:text-slate-400">004
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
                                            <CopyCode code="^.*" tone="pink" />
                                            <span class="text-xs text-slate-400">{{
                                                $t('help.numbering.example.selectAll') }}</span>
                                        </div>
                                        <div class="flex items-center gap-2 text-sm font-mono">
                                            <span class="text-slate-500 w-12">{{ $t('help.numbering.example.replace')
                                            }}</span>
                                            <CopyCode code="Image_${n:03}" tone="green" />
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </section>

                        <hr class="border-slate-200 dark:border-slate-800">

                        <!-- AI assistant quick start -->
                        <section class="space-y-3">
                            <div class="flex items-center justify-between gap-2">
                                <h4 class="text-base font-bold text-sky-600 dark:text-sky-400 flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                                    {{ $t('help.ai.title') }}
                                </h4>
                                <button type="button" @click="openAiPanel"
                                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white cursor-pointer shadow-2xs">
                                    <Sparkles class="w-3.5 h-3.5" />
                                    {{ $t('help.ai.openPanel') }}
                                </button>
                            </div>
                            <p class="text-sm text-slate-500 dark:text-slate-400">{{ $t('help.ai.description') }}</p>

                            <div class="grid sm:grid-cols-2 gap-3">
                                <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <div class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{{ $t('help.ai.cliTitle') }}</div>
                                    <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{{ $t('help.ai.cliDesc') }}</p>
                                </div>
                                <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                    <div class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">{{ $t('help.ai.apiTitle') }}</div>
                                    <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{{ $t('help.ai.apiDesc') }}</p>
                                </div>
                            </div>

                            <div>
                                <div class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{{ $t('help.ai.flowTitle') }}</div>
                                <ol class="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                                    <template v-for="(step, i) in aiSteps" :key="step">
                                        <li class="px-2 py-1 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-900/60">
                                            {{ i + 1 }}. {{ $t(step) }}
                                        </li>
                                        <span v-if="i < aiSteps.length - 1" class="text-slate-400" aria-hidden="true">→</span>
                                    </template>
                                </ol>
                            </div>

                            <div>
                                <div class="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">{{ $t('help.ai.examplesTitle') }}</div>
                                <div class="flex flex-col gap-1.5">
                                    <button v-for="example in aiExamples" :key="example" type="button" @click="askAi($t(example))"
                                        v-tooltip="$t('help.ai.askThis')"
                                        class="text-left text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 hover:border-sky-400 dark:hover:border-sky-600 hover:bg-sky-50/60 dark:hover:bg-sky-950/30 cursor-pointer transition-colors">
                                        “{{ $t(example) }}”
                                    </button>
                                </div>
                                <p class="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{{ $t('help.ai.examplesTip') }}</p>
                            </div>

                            <p class="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                                <ShieldCheck class="w-3.5 h-3.5 shrink-0 mt-px text-slate-400" />
                                <span>{{ $t('help.ai.privacy') }}</span>
                            </p>
                        </section>

                        <hr class="border-slate-200 dark:border-slate-800">

                        <!-- Keyboard shortcuts -->
                        <section class="space-y-3">
                            <h4 class="text-base font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                {{ $t('help.shortcuts.title') }}
                            </h4>
                            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                                <div v-for="item in shortcuts" :key="item.label"
                                    class="flex items-center justify-between gap-3 py-1 border-b border-slate-100 dark:border-slate-800/80">
                                    <dt class="text-slate-600 dark:text-slate-300">{{ $t(item.label) }}</dt>
                                    <dd class="flex items-center gap-1 shrink-0">
                                        <kbd v-for="k in item.keys" :key="k"
                                            class="min-w-6 text-center px-1.5 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-200 shadow-2xs">{{ k }}</kbd>
                                    </dd>
                                </div>
                            </dl>
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
