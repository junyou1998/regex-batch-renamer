<script setup lang="ts">
import { ref } from 'vue'
import { RELEASES_URL, useRelease } from '../composables/useRelease'

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
        <h2 id="download-title" class="text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{{ $t('download.title') }}</h2>
        <p class="mt-3 text-lg text-slate">
          {{ $t('download.lede') }}<template v-if="version"> {{ $t('download.version', { version }) }}</template>
        </p>
      </div>
      <a :href="RELEASES_URL" class="text-[15px] font-medium text-signal hover:underline" rel="noopener">{{ $t('download.allReleases') }}</a>
    </div>

    <div class="mt-10 grid gap-4 md:grid-cols-3">
      <div v-for="p in PLATFORMS" :key="p.id" class="rounded-2xl border bg-white p-6"
        :class="platform === p.id ? 'border-signal ring-1 ring-signal' : 'border-line'">
        <div class="flex items-baseline justify-between">
          <h3 class="text-lg font-semibold">{{ $t(`platforms.${p.id}`) }}</h3>
          <span v-if="platform === p.id" class="text-sm text-signal">{{ $t('download.yourSystem') }}</span>
        </div>
        <div class="mt-5 flex flex-col gap-2">
          <a v-for="(file, i) in p.files" :key="file.key" :href="urlFor(file.key)"
            class="rounded-lg px-4 py-2.5 text-center text-[15px] font-medium"
            :class="i === 0 ? 'bg-ink text-white hover:bg-ink-soft' : 'border border-line text-ink hover:border-slate/50'">
            {{ $t(file.label) }}
          </a>
        </div>
      </div>
    </div>

    <p class="mt-6 text-[15px] text-slate">{{ $t('download.autoUpdate') }}</p>

    <div class="mt-8 rounded-2xl bg-white p-6 ring-1 ring-line">
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
  </section>
</template>
