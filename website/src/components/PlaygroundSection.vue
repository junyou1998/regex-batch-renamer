<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { applyRule, compile, diff, type Rule } from '../utils/rename'

const { t } = useI18n()

const FILES = [
  'IMG_20260812_093015.jpg',
  'IMG_20260812_143022.jpg',
  'IMG_20260813_080511.jpg',
  'Quarterly Report v3 FINAL.docx',
  'budget_draft_COPY.xlsx',
  'meeting notes  2026-03-04.txt',
]

type PresetKey = 'camera' | 'cleanup' | 'spaces' | 'number'
const PRESETS: Record<PresetKey, Rule> = {
  camera: { find: 'IMG_(\\d{4})(\\d{2})(\\d{2})_\\d{6}', replace: '$1-$2-$3 Trip ${n:3}', regex: true, ignoreCase: false },
  cleanup: { find: '[ _-]*(copy|final|v\\d+)(?=[ _-]|$)', replace: '', regex: true, ignoreCase: true },
  spaces: { find: '\\s+', replace: '_', regex: true, ignoreCase: false },
  number: { find: '^.*', replace: 'File_${n:2}', regex: true, ignoreCase: false },
}

const rule = reactive<Rule>({ ...PRESETS.camera })
const active = ref<PresetKey | null>('camera')

function usePreset(key: PresetKey) {
  Object.assign(rule, PRESETS[key])
  active.value = key
}

function edited() {
  active.value = null
}

const error = computed(() => compile(rule).error)
const rows = computed(() =>
  FILES.map((name, i) => {
    const next = error.value ? name : applyRule(name, rule, i)
    return { name, next, changed: next !== name, parts: diff(name, next) }
  }),
)
const changedCount = computed(() => rows.value.filter((r) => r.changed).length)
const presetKeys = Object.keys(PRESETS) as PresetKey[]
</script>

<template>
  <section class="bg-ink py-20 text-white sm:py-24" aria-labelledby="playground-title">
    <div class="mx-auto max-w-6xl px-5 sm:px-8">
      <div v-reveal class="max-w-2xl">
        <h2 id="playground-title" class="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{{ $t('playground.title') }}</h2>
        <p class="mt-4 text-lg leading-relaxed text-white/70">{{ $t('playground.lede') }}</p>
      </div>

      <div v-reveal="120" class="mt-10 grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <!-- Rule editor, styled like the app's rule card -->
        <div class="rounded-2xl bg-ink-soft p-5 ring-1 ring-white/10">
          <label class="block text-sm font-medium text-white/70" for="pg-find">{{ $t('playground.find') }}</label>
          <div class="mt-2 flex items-center rounded-lg bg-ink ring-1 ring-white/15 focus-within:ring-2 focus-within:ring-signal"
            :class="error ? '!ring-2 !ring-removed' : ''">
            <input id="pg-find" v-model="rule.find" @input="edited" spellcheck="false" autocomplete="off"
              class="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[15px] text-white placeholder-white/30 focus:outline-none"
              :placeholder="$t('playground.findPlaceholder')" />
            <button type="button" @click="rule.regex = !rule.regex; edited()" :aria-pressed="rule.regex"
              :title="$t('playground.regex')"
              class="mr-1 h-7 min-w-8 rounded-md px-1.5 font-mono text-xs font-bold"
              :class="rule.regex ? 'bg-signal text-white' : 'text-white/45 hover:text-white'">.*</button>
            <button type="button" @click="rule.ignoreCase = !rule.ignoreCase; edited()" :aria-pressed="rule.ignoreCase"
              :title="$t('playground.ignoreCase')"
              class="mr-1.5 h-7 min-w-8 rounded-md px-1.5 text-xs font-bold"
              :class="rule.ignoreCase ? 'bg-signal text-white' : 'text-white/45 hover:text-white'">Aa</button>
          </div>
          <p v-if="error" class="mt-2 text-sm text-red-300" role="alert">{{ $t('playground.invalid') }}</p>

          <label class="mt-5 block text-sm font-medium text-white/70" for="pg-replace">{{ $t('playground.replace') }}</label>
          <input id="pg-replace" v-model="rule.replace" @input="edited" spellcheck="false" autocomplete="off"
            class="mt-2 w-full rounded-lg bg-ink px-3 py-2.5 font-mono text-[15px] text-white placeholder-white/30 ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-signal"
            :placeholder="$t('playground.replacePlaceholder')" />

          <p class="mt-6 text-sm font-medium text-white/70">{{ $t('playground.presetLabel') }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button v-for="key in presetKeys" :key="key" type="button" @click="usePreset(key)" :aria-pressed="active === key"
              class="rounded-full px-3.5 py-1.5 text-sm transition-all duration-200 active:scale-95"
              :class="active === key ? 'bg-white text-ink' : 'bg-white/8 text-white/80 ring-1 ring-white/15 hover:bg-white/15'">
              {{ $t(`playground.presets.${key}`) }}
            </button>
          </div>
        </div>

        <!-- Live preview -->
        <div class="overflow-hidden rounded-2xl bg-white text-ink ring-1 ring-white/10">
          <div class="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
            <span class="font-medium">{{ $t('playground.previewTitle') }}</span>
            <span class="flex items-center gap-2 text-slate" aria-live="polite">
              <span class="relative flex h-2 w-2"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-added/50" /><span class="relative inline-flex h-2 w-2 rounded-full bg-added" /></span>
              {{ t('playground.changed', { n: changedCount, total: rows.length }) }}
            </span>
          </div>
          <ul class="divide-y divide-line">
            <li v-for="row in rows" :key="row.name" class="px-5 py-3">
              <div class="truncate font-mono text-[13px] text-slate">{{ row.name }}</div>
              <div class="row-result mt-1 truncate font-mono text-[15px]" :key="row.next">
                <template v-if="row.changed">
                  <span>{{ row.parts.prefix }}</span><del v-if="row.parts.removed"
                    class="rounded bg-removed-bg px-0.5 text-removed decoration-removed/60">{{ row.parts.removed }}</del><ins
                    v-if="row.parts.added" class="rounded bg-added-bg px-0.5 text-added no-underline">{{ row.parts.added }}</ins><span>{{ row.parts.suffix }}</span>
                </template>
                <span v-else class="font-sans text-sm text-slate/70">{{ $t('playground.unchanged') }}</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <p class="mt-6 text-sm text-white/55">{{ $t('playground.note') }}</p>
    </div>
  </section>
</template>

<style scoped>
/* Each time a result changes, it slides in, so you can see what the rule did. */
.row-result {
  animation: result-in 0.35s cubic-bezier(0.2, 0.7, 0.2, 1);
}

@keyframes result-in {
  from {
    opacity: 0;
    transform: translateX(-6px);
  }
}
</style>
