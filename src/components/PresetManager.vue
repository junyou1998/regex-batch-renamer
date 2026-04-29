<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOperationStore } from '../stores/operationStore'
import {
    loadPresets,
    deletePreset,
    renamePreset,
    exportPresetsJSON,
    importPresetsJSON,
    type Preset,
} from '../services/presetService'
import { Download, FolderOpen, Pencil, Trash2, X } from 'lucide-vue-next'

const emit = defineEmits<{
    (e: 'close'): void
    (e: 'loaded', name: string): void
}>()

const { t } = useI18n()
const operationStore = useOperationStore()

const presets = ref<Preset[]>(loadPresets())
const editingId = ref<string | null>(null)
const editingName = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function refresh() {
    presets.value = loadPresets()
}

const sortedPresets = computed(() =>
    [...presets.value].sort((a, b) => b.createdAt - a.createdAt)
)

function handleLoad(preset: Preset) {
    operationStore.loadFromPreset(preset.operations)
    emit('loaded', preset.name)
    emit('close')
}

function handleDelete(preset: Preset) {
    if (!confirm(t('templates.deleteConfirm', { name: preset.name }))) return
    deletePreset(preset.id)
    refresh()
}

function startRename(preset: Preset) {
    editingId.value = preset.id
    editingName.value = preset.name
}

function confirmRename() {
    if (editingId.value && editingName.value.trim()) {
        renamePreset(editingId.value, editingName.value.trim())
        refresh()
    }
    editingId.value = null
}

function handleExport() {
    const json = exportPresetsJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'renamer-presets.json'
    a.click()
    URL.revokeObjectURL(url)
}

function handleImportClick() {
    fileInput.value?.click()
}

function handleImportFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
        try {
            const { count, skipped } = importPresetsJSON(reader.result as string)
            refresh()
            if (skipped > 0) {
                alert(t('templates.importSuccessWithSkip', { n: count, s: skipped }))
            } else {
                alert(t('templates.importSuccess', { n: count }))
            }
        } catch {
            alert(t('templates.importError'))
        }
    }
    reader.readAsText(file)
    input.value = ''
}

function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}
</script>

<template>
    <Teleport to="body">
        <Transition name="fade">
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')"></div>

                <div
                    class="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">

                    <!-- Header -->
                    <div
                        class="flex items-center justify-between p-5 pb-3 border-b border-slate-200 dark:border-slate-700">
                        <h3 class="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                            <FolderOpen class="h-5 w-5" />
                            {{ $t('templates.title') }}
                        </h3>
                        <button @click="emit('close')"
                            class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                            <X class="h-5 w-5" />
                        </button>
                    </div>

                    <!-- Preset List -->
                    <div class="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-2">
                        <div v-if="sortedPresets.length === 0"
                            class="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
                            {{ $t('templates.empty') }}
                        </div>

                        <div v-for="preset in sortedPresets" :key="preset.id"
                            class="group flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500 transition-colors">

                            <!-- Info -->
                            <div class="flex-1 min-w-0">
                                <div v-if="editingId === preset.id" class="flex items-center gap-2">
                                    <input v-model="editingName" @keydown.enter="!$event.isComposing && confirmRename()"
                                        @blur="confirmRename" autofocus
                                        class="flex-1 px-2 py-1 text-sm border border-blue-400 rounded dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50" />
                                </div>
                                <template v-else>
                                    <div class="font-medium text-sm text-slate-800 dark:text-white truncate">{{
                                        preset.name }}</div>
                                    <div class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                        {{ $t('templates.ops', { n: preset.operations.length }) }} · {{
                                            formatDate(preset.createdAt) }}
                                    </div>
                                </template>
                            </div>

                            <!-- Actions -->
                            <div
                                class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button @click="handleLoad(preset)" :title="$t('templates.load')"
                                    class="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-md transition-colors cursor-pointer">
                                    <Download class="h-4 w-4" />
                                </button>
                                <button @click="startRename(preset)" :title="$t('templates.rename')"
                                    class="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-md transition-colors cursor-pointer">
                                    <Pencil class="h-4 w-4" />
                                </button>
                                <button @click="handleDelete(preset)" :title="$t('templates.delete')"
                                    class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors cursor-pointer">
                                    <Trash2 class="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div
                        class="flex items-center justify-between p-4 pt-3 border-t border-slate-200 dark:border-slate-700 gap-2">
                        <div class="flex gap-2">
                            <button @click="handleExport" :disabled="sortedPresets.length === 0"
                                class="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                                {{ $t('templates.export') }}
                            </button>
                            <button @click="handleImportClick"
                                class="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer">
                                {{ $t('templates.import') }}
                            </button>
                            <input ref="fileInput" type="file" accept=".json" class="hidden"
                                @change="handleImportFile" />
                        </div>
                        <button @click="emit('close')"
                            class="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm cursor-pointer">
                            {{ $t('common.done') }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
