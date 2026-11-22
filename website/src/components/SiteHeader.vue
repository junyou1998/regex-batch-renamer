<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LOCALES, setLocale, type SiteLocale } from '../i18n'
import { REPO } from '../composables/useRelease'

const { locale } = useI18n()
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
      <a href="#top" class="flex items-center gap-2.5 font-semibold tracking-tight">
        <img src="/app-icon.png" alt="" width="28" height="28" class="rounded-md" />
        <span class="text-[17px]">Renamix</span>
      </a>
      <nav class="ml-auto flex items-center gap-1 text-[15px] text-slate">
        <a href="#features" class="hidden rounded-md px-3 py-1.5 hover:text-ink sm:block">{{ $t('nav.features') }}</a>
        <a href="#download" class="hidden rounded-md px-3 py-1.5 hover:text-ink sm:block">{{ $t('nav.download') }}</a>
        <a :href="`https://github.com/${REPO}`" class="rounded-md px-3 py-1.5 hover:text-ink" rel="noopener">GitHub</a>
        <label class="relative ml-1">
          <span class="sr-only">{{ $t('nav.language') }}</span>
          <select
            :value="locale"
            @change="setLocale(($event.target as HTMLSelectElement).value as SiteLocale)"
            class="cursor-pointer appearance-none rounded-md border border-line bg-white py-1.5 pl-3 pr-8 text-sm text-ink hover:border-slate/50"
          >
            <option v-for="l in LOCALES" :key="l.code" :value="l.code">{{ l.label }}</option>
          </select>
          <svg class="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" /></svg>
        </label>
      </nav>
    </div>
  </header>
</template>
