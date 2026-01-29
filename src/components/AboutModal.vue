<script setup lang="ts">
import { ref, watch } from 'vue'
import { marked } from 'marked'
import pkg from '../../package.json'
import { useToastStore } from '../stores/toastStore'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
    modelValue: boolean
}>()

defineEmits<{
    (e: 'update:modelValue', value: boolean): void
}>()

const showChangelog = ref(false)
const changelogContent = ref('')
const isLoading = ref(false)
const error = ref('')

const hasUpdate = ref(false)
const latestVersion = ref('')

const toastStore = useToastStore()
const { t } = useI18n()

async function handleChangelogClick(event: MouseEvent) {
    const target = event.target as HTMLElement
    const pre = target.closest('pre')
    if (pre) {
        const code = pre.textContent || ''
        try {
            await navigator.clipboard.writeText(code)
            toastStore.addToast(t('preview.copied', { text: 'Code' }), 'success')
        } catch (e) {
            toastStore.addToast(t('preview.copyFailed'), 'error')
        }
    }
}

// Reset view when modal opens
watch(() => props.modelValue, (newVal) => {
    if (newVal) {
        showChangelog.value = false
        checkForUpdates()
    }
})

async function checkForUpdates() {
    try {
        const response = await fetch('https://api.github.com/repos/junyou1998/regex-batch-renamer/releases/latest')
        if (!response.ok) return

        const data = await response.json()
        const tagName = data.tag_name.replace(/^v/, '') // Remove 'v' prefix if present

        // Simple version comparison (assuming semver)
        if (tagName !== pkg.version) {
            hasUpdate.value = true
            latestVersion.value = tagName
        }
    } catch (e) {
        console.error('Failed to check for updates', e)
    }
}

async function fetchChangelog() {
    if (changelogContent.value) return // Already fetched

    isLoading.value = true
    error.value = ''
    try {
        const response = await fetch('https://api.github.com/repos/junyou1998/regex-batch-renamer/releases/latest')
        if (!response.ok) throw new Error('Failed to fetch')

        const data = await response.json()
        changelogContent.value = await marked.parse(data.body, { breaks: true, gfm: true })
    } catch (e) {
        error.value = 'Failed to load changelog'
        console.error(e)
    } finally {
        isLoading.value = false
    }
}

function toggleChangelog() {
    showChangelog.value = !showChangelog.value
    if (showChangelog.value && !changelogContent.value) {
        fetchChangelog()
    }
}

function openExternal(url: string) {
    window.ipcRenderer?.invoke('open-external', url)
}
</script>

<template>
    <Teleport to="body">
        <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
            enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100" leave-to-class="opacity-0">
            <div v-if="modelValue"
                class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                @click.self="$emit('update:modelValue', false)">

                <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 transform transition-all max-h-[85vh]"
                    role="dialog" aria-modal="true">
                    <!-- Header -->
                    <div
                        class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                        <div class="flex items-center gap-3">
                            <button v-if="showChangelog" @click="showChangelog = false"
                                class="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20"
                                    fill="currentColor">
                                    <path fill-rule="evenodd"
                                        d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                                        clip-rule="evenodd" />
                                </svg>
                            </button>
                            <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                {{ showChangelog ? $t('about.changelog') : $t('about.title') }}
                            </h3>
                        </div>
                        <button @click="$emit('update:modelValue', false)"
                            class="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20"
                                fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 overflow-y-auto custom-scrollbar p-6">

                        <!-- Changelog View -->
                        <div v-if="showChangelog" class="space-y-4">
                            <div v-if="isLoading" class="flex justify-center py-8 text-slate-500">
                                <svg class="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none"
                                    viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                        stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                                    </path>
                                </svg>
                                <span class="ml-2">{{ $t('about.changelogLoading') }}</span>
                            </div>
                            <div v-else-if="error" class="text-center text-red-500 py-8">
                                {{ $t('about.changelogError') }}
                            </div>
                            <!-- Markdown Content -->
                            <!-- 
                                - prose-sm: Removed to allow larger headers
                                - break-words: Force wrapping for long words
                                - prose-pre:whitespace-pre-wrap: Force wrapping for code blocks to prevent horizontal scroll
                                - prose-a:text-blue-500: improved link visibility
                                - prose-img:rounded-lg: better image styling
                             -->
                            <div v-else
                                class="changelog-content prose prose-slate dark:prose-invert max-w-none wrap-break-word"
                                v-html="changelogContent" @click="handleChangelogClick">
                            </div>

                            <div class="text-center pt-4">
                                <a href="#"
                                    @click.prevent="openExternal('https://github.com/junyou1998/regex-batch-renamer/releases')"
                                    class="text-blue-500 hover:underline text-sm cursor-pointer">{{
                                        $t('about.viewOnGithub') }}</a>
                            </div>
                        </div>

                        <!-- Main About View -->
                        <div v-else class="space-y-6">
                            <!-- Project Info -->
                            <div class="text-center space-y-2">
                                <a href="#" @click.prevent="openExternal('https://renamer.junyou.tw')"
                                    class="block transition-transform hover:scale-105 active:scale-95 cursor-pointer w-fit mx-auto"
                                    title="https://renamer.junyou.tw">
                                    <img src="/icon.png" alt="App Icon" class="w-24 h-24 mx-auto mb-4" />
                                </a>
                                <a href="#" @click.prevent="openExternal('https://renamer.junyou.tw')"
                                    class="inline-block hover:underline decoration-slate-400 dark:decoration-slate-600 underline-offset-4 cursor-pointer"
                                    title="https://renamer.junyou.tw">
                                    <h4 class="text-xl font-bold text-slate-800 dark:text-white">Regex Batch Renamer
                                    </h4>
                                </a>
                                <div
                                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 mb-2 ml-2 relative">
                                    v{{ pkg.version }}
                                    <span v-if="hasUpdate" class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                        <span
                                            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                                    </span>
                                </div>
                                <div v-if="hasUpdate"
                                    class="text-xs text-amber-600 dark:text-amber-400 font-medium animate-pulse">
                                    {{ $t('about.newVersionAvailable') }}: v{{ latestVersion }}
                                </div>
                                <p class="text-sm text-slate-500 dark:text-slate-400">
                                    {{ $t('about.description') }}
                                </p>
                            </div>

                            <!-- Buttons -->
                            <div class="flex justify-center gap-3">
                                <button @click="toggleChangelog"
                                    class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer">
                                    <span>📜</span> {{ $t('about.changelog') }}
                                </button>
                            </div>

                            <hr class="border-slate-200 dark:border-slate-800">

                            <!-- Developer Info -->
                            <div class="space-y-3">
                                <h5
                                    class="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <span class="text-lg">👨‍💻</span> {{ $t('about.developer') }}
                                </h5>
                                <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {{ $t('about.bio') }}
                                </p>
                            </div>

                            <!-- Donation Button -->
                            <div class="pt-2 flex flex-col items-center">
                                <a href="#" @click.prevent="openExternal('https://www.buymeacoffee.com/junyou')"
                                    class="transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                                    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                                        alt="Buy Me A Coffee" style="height: 60px !important; width: 217px !important;">
                                </a>
                                <p class="text-xs text-center text-slate-400 dark:text-slate-500 mt-3">
                                    {{ $t('about.thanks') }}
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style>
/* Force dark mode text visibility for HTML content */
.dark .changelog-content,
.dark .changelog-content p,
.dark .changelog-content ul,
.dark .changelog-content li {
    color: #cbd5e1 !important;
    /* slate-300 */
}

.dark .changelog-content h1,
.dark .changelog-content h2,
.dark .changelog-content h3,
.dark .changelog-content strong,
.dark .changelog-content b {
    color: #f1f5f9 !important;
    /* slate-100 */
}

.dark .changelog-content a {
    color: #60a5fa !important;
    /* blue-400 */
}

/* Code Block Styling */
.changelog-content pre {
    white-space: pre-wrap !important;
    word-break: break-all !important;
    overflow-wrap: break-word !important;
    max-width: 100% !important;
    margin-top: 1rem !important;

    /* Box Styling */
    padding: 1rem !important;
    border-radius: 0.5rem !important;
    /* rounded-lg */
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
    font-size: 0.875rem !important;
    /* text-sm */

    cursor: pointer !important;
    position: relative;
    transition: all 0.2s ease;

    /* Default (Light Mode) Colors */
    background-color: #f1f5f9 !important;
    /* slate-100 */
    border: 1px solid #e2e8f0 !important;
    /* slate-200 */
    color: #1e293b !important;
    /* slate-800 */
}

.dark .changelog-content pre {
    /* Dark Mode Colors Override */
    background-color: #1e293b !important;
    /* slate-800 */
    border: 1px solid #334155 !important;
    /* slate-700 */
    color: #e2e8f0 !important;
    /* slate-200 */
}

.changelog-content pre:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.changelog-content pre:active {
    transform: translateY(0);
    box-shadow: none;
}

/* Typography Sizing & Spacing Restoration */
.changelog-content h1 {
    font-size: 1.5rem !important;
    /* text-2xl */
    font-weight: 700 !important;
    margin-top: 1.5rem !important;
    margin-bottom: 0.75rem !important;
    line-height: 1.33 !important;
}

.changelog-content h2 {
    font-size: 1.25rem !important;
    /* text-xl */
    font-weight: 600 !important;
    margin-top: 1.25rem !important;
    margin-bottom: 0.5rem !important;
    line-height: 1.33 !important;
}

.changelog-content h3 {
    font-size: 1.125rem !important;
    /* text-lg */
    font-weight: 600 !important;
    margin-top: 1rem !important;
    margin-bottom: 0.5rem !important;
    line-height: 1.33 !important;
}

.changelog-content ul {
    list-style-type: disc !important;
    padding-left: 1.625rem !important;
    margin-top: 0.75rem !important;
    margin-bottom: 0.75rem !important;
}

.changelog-content li {
    margin-top: 0.25rem !important;
    margin-bottom: 0.25rem !important;
}
</style>
