<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { marked } from 'marked'
import { useToastStore } from '../stores/toastStore'
import { useI18n } from 'vue-i18n'
import {
    getLatestRelease,
    getReleasePageUrl,
    getReleases,
    isNewerVersion,
    normalizeReleaseVersion,
    type ReleaseInfo,
} from '../services/updateService'
import { desktop } from '../services/desktop'
import type { DesktopRuntimeInfo } from '../services/desktop'
import { ArrowLeft, CalendarDays, Download, ExternalLink, LoaderCircle, RefreshCw, ScrollText, X } from 'lucide-vue-next'

const props = defineProps<{
    modelValue: boolean
    initialView?: 'about' | 'changelog'
    initialReleaseTag?: string | null
    postUpdateVersion?: string | null
}>()

defineEmits<{
    (e: 'update:modelValue', value: boolean): void
}>()

const showChangelog = ref(props.initialView === 'changelog')
const releases = ref<ReleaseInfo[]>([])
const isLoading = ref(false)
const error = ref('')

const hasUpdate = ref(false)
const latestVersion = ref('')
const currentVersion = ref('')
const runtimeInfo = ref<DesktopRuntimeInfo | null>(null)
const isInstallingUpdate = ref(false)

const toastStore = useToastStore()
const { t } = useI18n()

function getResolvedReleaseUrl() {
    return getReleasePageUrl()
}

const focusedReleaseTag = ref(props.initialReleaseTag ?? null)
const focusTagNormalized = computed(() => normalizeReleaseVersion(focusedReleaseTag.value ?? ''))
const highlightedRelease = computed(() => {
    if (!focusedReleaseTag.value) return null
    return releases.value.find((release) => release.tagName === focusedReleaseTag.value) ?? null
})

function renderMarkdown(markdown: string) {
    return marked.parse(markdown || '', { breaks: true, gfm: true }) as string
}

function getInAppUpdateBlockedReason() {
    if (runtimeInfo.value?.runtime !== 'tauri' || runtimeInfo.value.platform !== 'darwin') return null
    if (runtimeInfo.value.appBundleParentWritable === false) {
        return t('about.updateInstallBlockedMac')
    }
    return null
}

function openReleaseFallback(message: string) {
    const url = getResolvedReleaseUrl()
    toastStore.addToast(message, 'error', 6000, {
        label: t('about.downloadUpdate'),
        onClick: () => openExternal(url),
    })
    openExternal(url)
}

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


watch(() => props.modelValue, (newVal) => {
    if (newVal) {
        showChangelog.value = props.initialView === 'changelog'
        focusedReleaseTag.value = props.initialReleaseTag ?? null
        void initializeAboutState()
    }
})

watch(() => props.initialView, (value) => {
    showChangelog.value = value === 'changelog'
})

watch(() => props.initialReleaseTag, (value) => {
    focusedReleaseTag.value = value ?? null
})

async function initializeAboutState() {
    await loadRuntimeInfo()
    await checkForUpdates()
    if (showChangelog.value) {
        await fetchChangelog()
    }
}

async function loadRuntimeInfo() {
    try {
        const info = await desktop.getRuntimeInfo()
        runtimeInfo.value = info
        currentVersion.value = info.version
    } catch (e) {
        console.error('Failed to get runtime info', e)
        currentVersion.value = ''
    }
}

async function checkForUpdates() {
    hasUpdate.value = false
    latestVersion.value = ''

    try {
        if (runtimeInfo.value?.runtime === 'tauri' && desktop.checkForAppUpdate) {
            const update = await desktop.checkForAppUpdate()
            if (update?.available && update.version) {
                hasUpdate.value = true
                latestVersion.value = normalizeReleaseVersion(update.version)
                return
            }
        }

        const release = await getLatestRelease({ channel: runtimeInfo.value?.channel })
        if (!release || !currentVersion.value) return

        const tagName = normalizeReleaseVersion(release.tagName)
        if (isNewerVersion(currentVersion.value, tagName)) {
            hasUpdate.value = true
            latestVersion.value = tagName
        }
    } catch (e) {
        console.error('Failed to check for updates', e)
        toastStore.addToast(t('about.updateCheckFailed'), 'error')
    }
}

async function fetchChangelog() {
    isLoading.value = true
    error.value = ''
    try {
        const history = await getReleases({ channel: runtimeInfo.value?.channel })
        releases.value = history
        if (!focusedReleaseTag.value && history.length > 0) {
            focusedReleaseTag.value = history[0].tagName
        }
    } catch (e) {
        error.value = 'Failed to load changelog'
        console.error(e)
    } finally {
        isLoading.value = false
    }
}

function toggleChangelog() {
    showChangelog.value = !showChangelog.value
    if (showChangelog.value && releases.value.length === 0) {
        fetchChangelog()
    }
}

function openReleaseTag(tagName: string) {
    openExternal(getReleasePageUrl(tagName))
}

function formatReleaseDate(value: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
}

function openExternal(url: string) {
    void desktop.openExternal(url)
}

async function installUpdate() {
    if (!desktop.installAppUpdate) return

    const blockedReason = getInAppUpdateBlockedReason()
    if (blockedReason) {
        openReleaseFallback(blockedReason)
        return
    }

    isInstallingUpdate.value = true
    try {
        if (latestVersion.value) {
            localStorage.setItem('regex-batch-renamer:pending-updated-version', latestVersion.value)
        }
        await desktop.installAppUpdate()
        toastStore.addToast(t('about.updateInstallStarted'), 'success')
    } catch (e) {
        localStorage.removeItem('regex-batch-renamer:pending-updated-version')
        console.error('Failed to install update', e)
        openReleaseFallback(t('about.updateInstallFailedFallback'))
    } finally {
        isInstallingUpdate.value = false
    }
}

async function openChangelogForTag(tagName: string) {
    focusedReleaseTag.value = tagName
    showChangelog.value = true
    if (releases.value.length === 0) {
        await fetchChangelog()
    }
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
                                <ArrowLeft class="h-5 w-5" />
                            </button>
                            <h3 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                {{ showChangelog ? $t('about.changelog') : $t('about.title') }}
                            </h3>
                        </div>
                        <button @click="$emit('update:modelValue', false)"
                            class="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                            <X class="h-5 w-5" />
                        </button>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 overflow-y-auto custom-scrollbar p-6">

                        <!-- Changelog View -->
                        <div v-if="showChangelog" class="space-y-4">
                            <div v-if="isLoading" class="flex justify-center py-8 text-slate-500">
                                <LoaderCircle class="animate-spin h-6 w-6" />
                                <span class="ml-2">{{ $t('about.changelogLoading') }}</span>
                            </div>
                            <div v-else-if="error" class="text-center text-red-500 py-8">
                                {{ $t('about.changelogError') }}
                            </div>
                            <div v-else-if="releases.length === 0"
                                class="text-center text-slate-500 dark:text-slate-400 py-8">
                                {{ $t('about.changelogEmpty') }}
                            </div>
                            <div v-else class="space-y-4">
                                <div v-if="postUpdateVersion && highlightedRelease"
                                    class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/40 dark:text-emerald-300">
                                    {{ $t('about.postUpdateTitle', { version: focusTagNormalized }) }}
                                </div>

                                <article v-for="release in releases" :key="release.tagName"
                                    class="rounded-2xl border p-4 transition-colors"
                                    :class="release.tagName === focusedReleaseTag
                                        ? 'border-blue-300 bg-blue-50/80 dark:border-blue-700 dark:bg-blue-950/30'
                                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50'">
                                    <div class="flex flex-wrap items-start justify-between gap-3">
                                        <div class="space-y-2">
                                            <div class="flex items-center gap-2">
                                                <span
                                                    class="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                    {{ release.tagName }}
                                                </span>
                                                <span
                                                    class="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <CalendarDays class="h-3.5 w-3.5" />
                                                    {{ formatReleaseDate(release.publishedAt) }}
                                                </span>
                                            </div>
                                            <button @click="openChangelogForTag(release.tagName)"
                                                class="text-left text-sm font-semibold text-slate-800 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400 cursor-pointer">
                                                v{{ normalizeReleaseVersion(release.tagName) }}
                                            </button>
                                        </div>
                                        <button @click="openReleaseTag(release.tagName)"
                                            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                                            <ExternalLink class="h-3.5 w-3.5" />
                                            {{ $t('about.viewVersionRelease') }}
                                        </button>
                                    </div>

                                    <div class="mt-4 changelog-content prose prose-slate dark:prose-invert max-w-none wrap-break-word"
                                        v-html="renderMarkdown(release.body)" @click="handleChangelogClick">
                                    </div>
                                </article>

                                <div class="text-center pt-2">
                                    <a href="#"
                                        @click.prevent="openExternal('https://github.com/junyou1998/regex-batch-renamer/releases')"
                                        class="text-blue-500 hover:underline text-sm cursor-pointer">{{
                                            $t('about.viewOnGithub') }}</a>
                                </div>
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
                                    v{{ currentVersion || '...' }}
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
                                    <ScrollText class="h-4 w-4" /> {{ $t('about.changelog') }}
                                </button>
                                <button v-if="hasUpdate && runtimeInfo?.runtime === 'tauri'" @click="installUpdate"
                                    :disabled="isInstallingUpdate"
                                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer">
                                    <LoaderCircle v-if="isInstallingUpdate" class="animate-spin h-4 w-4" />
                                    <Download v-else class="h-4 w-4" />
                                    {{ isInstallingUpdate ? $t('about.installingUpdate') : $t('about.installUpdate') }}
                                </button>
                                <a v-else-if="hasUpdate" href="#"
                                    @click.prevent="openExternal('https://github.com/junyou1998/regex-batch-renamer/releases')"
                                    class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer">
                                    <RefreshCw class="h-4 w-4" /> {{ $t('about.downloadUpdate') }}
                                </a>
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
