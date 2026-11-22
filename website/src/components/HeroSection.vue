<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { screenshotLang } from '../i18n'
import { useRelease } from '../composables/useRelease'

const { t, locale } = useI18n()
const { version, platform, primaryUrl } = useRelease()
const theme = ref<'light' | 'dark'>('light')

const platformName = computed(() => t(`platforms.${platform.value}`))
const shot = computed(() => `/screenshots/${screenshotLang(locale.value)}/${theme.value === 'dark' ? 'dark' : 'hero'}.webp`)
</script>

<template>
  <section id="top" class="mx-auto max-w-6xl overflow-x-clip px-5 pb-20 pt-14 sm:px-8 lg:overflow-visible lg:pt-20">
    <div class="grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        <!-- The headline "renames itself": a messy filename is struck out, the clean sentence replaces it. -->
        <p class="hero-old font-mono text-[15px] text-removed" :key="`old-${locale}`">
          <span class="hero-old__text">{{ $t('hero.messy') }}</span>
        </p>
        <h1 class="hero-new mt-3 text-balance text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.025em] sm:text-[3.25rem]" :key="`new-${locale}`">
          {{ $t('hero.title') }}
        </h1>
        <p class="mt-6 max-w-[34rem] text-lg leading-relaxed text-slate">{{ $t('hero.lede') }}</p>

        <div class="mt-9 flex flex-wrap items-center gap-3">
          <a :href="primaryUrl"
            class="inline-flex items-center gap-2 rounded-lg bg-signal px-5 py-3 font-medium text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,.7)] hover:bg-signal-deep">
            <svg class="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 3a1 1 0 0 1 1 1v7.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L9 11.6V4a1 1 0 0 1 1-1ZM4 15a1 1 0 0 1 1 1h10a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2 1 1 0 0 1 1-1Z" /></svg>
            {{ $t('hero.download', { platform: platformName }) }}
          </a>
          <a href="#download" class="rounded-lg px-4 py-3 font-medium text-ink hover:bg-white">{{ $t('hero.otherPlatforms') }}</a>
        </div>
        <p class="mt-5 text-sm text-slate">
          {{ $t('hero.meta') }}<template v-if="version"> {{ $t('hero.version', { version }) }}</template>
        </p>
      </div>

      <figure class="relative lg:-mr-12 xl:-mr-28">
        <img :src="shot" :alt="$t('hero.screenshotAlt')" width="2000" height="1250"
          class="w-full rounded-2xl shadow-[0_40px_80px_-30px_rgba(14,26,43,.45)] ring-1 ring-ink/5" />
        <figcaption class="mt-4 flex justify-end">
          <div class="inline-flex rounded-lg border border-line bg-white p-0.5 text-sm" role="group" :aria-label="$t('hero.themeLabel')">
            <button v-for="option in (['light', 'dark'] as const)" :key="option" type="button"
              @click="theme = option" :aria-pressed="theme === option"
              class="rounded-md px-3 py-1 transition-colors"
              :class="theme === option ? 'bg-ink text-white' : 'text-slate hover:text-ink'">
              {{ $t(`hero.${option}`) }}
            </button>
          </div>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.hero-old__text {
  background: linear-gradient(currentColor, currentColor) no-repeat 0 55% / 0% 1.5px;
  background-color: var(--color-removed-bg);
  padding: 0.1em 0.35em;
  border-radius: 4px;
  animation: strike 0.6s 0.35s cubic-bezier(0.6, 0, 0.3, 1) forwards;
}

.hero-new {
  opacity: 0;
  transform: translateY(6px);
  animation: arrive 0.7s 0.95s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}

@keyframes strike {
  to {
    background-size: 100% 1.5px;
  }
}

@keyframes arrive {
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
