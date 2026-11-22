<script setup lang="ts">
import { ref } from 'vue'
import { RELEASES_URL, SPONSOR_URL, useRelease } from '../composables/useRelease'

const { version, platform, urlFor } = useRelease()
const copied = ref(false)
const COMMAND = 'xattr -r -d com.apple.quarantine "/Applications/Renamix.app"'

async function copyCommand() {
  try {
    await navigator.clipboard.writeText(COMMAND)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    /* clipboard blocked: the command stays selectable */
  }
}

const PLATFORMS = [
  { id: 'mac', files: [{ key: 'macArm', label: 'download.mac.arm' }, { key: 'macIntel', label: 'download.mac.intel' }] },
  { id: 'windows', files: [{ key: 'windows', label: 'download.windows.file' }] },
  { id: 'linux', files: [{ key: 'appImage', label: 'download.linux.appImage' }, { key: 'deb', label: 'download.linux.deb' }] },
] as const
</script>

<template>
  <section id="download" class="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:px-8" aria-labelledby="download-title">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 v-reveal id="download-title" class="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{{ $t('download.title') }}</h2>
        <p class="mt-3 text-lg text-slate">
          {{ $t('download.lede') }}<template v-if="version"> {{ $t('download.version', { version }) }}</template>
        </p>
      </div>
      <a :href="RELEASES_URL" class="text-[15px] font-medium text-signal hover:underline" rel="noopener">{{ $t('download.allReleases') }}</a>
    </div>

    <div class="mt-10 grid gap-4 md:grid-cols-3">
      <div v-for="(p, i) in PLATFORMS" :key="p.id" v-reveal="i * 90"
        class="rounded-2xl border bg-white p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_24px_40px_-24px_rgba(14,26,43,.35)]"
        :class="platform === p.id ? 'border-signal ring-1 ring-signal' : 'border-line'">
        <div class="flex items-baseline justify-between">
          <h3 class="text-lg font-semibold">{{ $t(`platforms.${p.id}`) }}</h3>
          <span v-if="platform === p.id" class="text-sm text-signal">{{ $t('download.yourSystem') }}</span>
        </div>
        <div class="mt-5 flex flex-col gap-2">
          <a v-for="(file, i) in p.files" :key="file.key" :href="urlFor(file.key)"
            class="rounded-lg px-4 py-2.5 text-center text-[15px] font-medium transition-all duration-200 active:scale-[.98]"
            :class="i === 0 ? 'bg-ink text-white hover:bg-ink-soft' : 'border border-line text-ink hover:border-slate/50'">
            {{ $t(file.label) }}
          </a>
        </div>
      </div>
    </div>

    <p class="mt-6 text-[15px] text-slate">{{ $t('download.autoUpdate') }}</p>

    <div v-reveal class="mt-8 rounded-2xl bg-white p-6 ring-1 ring-line">
      <h3 class="font-semibold">{{ $t('download.macNoteTitle') }}</h3>
      <p class="mt-2 text-[15px] leading-relaxed text-slate">{{ $t('download.macNote') }}</p>
      <div class="mt-4 flex items-center gap-2 rounded-lg bg-ink py-2 pl-4 pr-2">
        <code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-white/90">{{ COMMAND }}</code>
        <button type="button" @click="copyCommand"
          class="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20">
          {{ copied ? $t('download.copied') : $t('download.copy') }}
        </button>
      </div>
    </div>

    <!-- Support: visible, friendly, not pushy -->
    <div v-reveal class="support mt-6 flex flex-col gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-start gap-4">
        <span class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm" aria-hidden="true">☕</span>
        <div>
          <h3 class="font-semibold">{{ $t('support.title') }}</h3>
          <p class="mt-1 max-w-[52ch] text-[15px] leading-relaxed text-slate">{{ $t('support.body') }}</p>
        </div>
      </div>
      <a :href="SPONSOR_URL" target="_blank" rel="noopener"
        class="group inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-ink px-5 py-2.5 text-[15px] font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-12px_rgba(14,26,43,.6)] sm:self-auto">
        <svg class="h-4 w-4 text-rose-400 transition-transform duration-300 group-hover:scale-125" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 17.3 8.9 16.3C4.9 12.7 2.3 10.3 2.3 7.4A4 4 0 0 1 6.3 3.4c1.4 0 2.7.6 3.7 1.7a5 5 0 0 1 3.7-1.7 4 4 0 0 1 4 4c0 2.9-2.6 5.3-6.6 8.9L10 17.3Z" /></svg>
        {{ $t('support.cta') }}
      </a>
    </div>
  </section>
</template>

<style scoped>
.support {
  background: linear-gradient(120deg, #fff1f2 0%, #fdf4ff 45%, #eff6ff 100%);
  border: 1px solid #fce7f3;
}
</style>
