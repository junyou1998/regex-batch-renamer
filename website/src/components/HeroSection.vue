<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { screenshotLang } from '../i18n'
import { useRelease } from '../composables/useRelease'
import HeroTitle from './HeroTitle.vue'

const { t, locale } = useI18n()
const { version, platform, primaryUrl } = useRelease()
const theme = ref<'light' | 'dark'>('light')
const titleRef = ref<InstanceType<typeof HeroTitle> | null>(null)

const platformName = computed(() => t(`platforms.${platform.value}`))
const shots = computed(() => {
  const dir = `/screenshots/${screenshotLang(locale.value)}`
  return { light: `${dir}/hero.webp`, dark: `${dir}/dark.webp` }
})
</script>

<template>
  <section id="top" class="hero relative isolate mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8 lg:pt-16">
    <div class="hero-glow" aria-hidden="true"><span /><span /></div>
    <div class="grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        <HeroTitle ref="titleRef" class="text-[2.5rem] sm:text-[3.15rem]" />
        <button type="button" @click="titleRef?.play()"
          class="replay mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-slate hover:bg-white hover:text-ink">
          <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 4a6 6 0 1 1-5.66 8 1 1 0 1 1 1.88-.67A4 4 0 1 0 7.2 7H9a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1V4a1 1 0 1 1 2 0v1.4A5.98 5.98 0 0 1 10 4Z" /></svg>
          {{ $t('hero.replay') }}
        </button>
        <p class="mt-6 max-w-[34rem] text-lg leading-relaxed text-slate">{{ $t('hero.lede') }}</p>

        <div class="mt-9 flex flex-wrap items-center gap-3">
          <a :href="primaryUrl"
            class="inline-flex items-center gap-2 rounded-xl bg-signal px-5 py-3 font-medium text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,.7)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-signal-deep hover:shadow-[0_14px_28px_-10px_rgba(37,99,235,.75)] active:translate-y-0 active:scale-[.98]">
            <svg class="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 3a1 1 0 0 1 1 1v7.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L9 11.6V4a1 1 0 0 1 1-1ZM4 15a1 1 0 0 1 1 1h10a1 1 0 1 1 0 2H5a2 2 0 0 1-2-2 1 1 0 0 1 1-1Z" /></svg>
            {{ $t('hero.download', { platform: platformName }) }}
          </a>
          <a href="#download" class="rounded-lg px-4 py-3 font-medium text-ink hover:bg-white">{{ $t('hero.otherPlatforms') }}</a>
        </div>
        <p class="mt-5 text-sm text-slate">
          {{ $t('hero.meta') }}<template v-if="version"> {{ $t('hero.version', { version }) }}</template>
        </p>
      </div>

      <figure class="hero-figure relative lg:-mr-12 xl:-mr-28">
        <div v-tilt="3" class="relative rounded-2xl shadow-[0_40px_80px_-30px_rgba(14,26,43,.45)] ring-1 ring-ink/5">
          <!-- Both themes are stacked and cross-faded so switching feels instant. -->
          <img :src="shots.light" :alt="$t('hero.screenshotAlt')" width="2000" height="1250" fetchpriority="high"
            class="block w-full rounded-2xl transition-opacity duration-500" :class="theme === 'light' ? 'opacity-100' : 'opacity-0'" />
          <img :src="shots.dark" alt="" aria-hidden="true" width="2000" height="1250" loading="lazy"
            class="absolute inset-0 block w-full rounded-2xl transition-opacity duration-500" :class="theme === 'dark' ? 'opacity-100' : 'opacity-0'" />
        </div>
        <figcaption class="mt-5 flex justify-end">
          <div class="relative inline-grid grid-cols-2 rounded-full border border-line bg-white p-1 text-sm" role="group" :aria-label="$t('hero.themeLabel')">
            <span class="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink transition-transform duration-300 ease-out"
              :class="theme === 'dark' ? 'translate-x-full' : ''" aria-hidden="true" />
            <button v-for="option in (['light', 'dark'] as const)" :key="option" type="button"
              @click="theme = option" :aria-pressed="theme === option"
              class="relative z-10 rounded-full px-4 py-1 transition-colors duration-300"
              :class="theme === option ? 'text-white' : 'text-slate hover:text-ink'">
              {{ $t(`hero.${option}`) }}
            </button>
          </div>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.hero-glow {
  position: absolute;
  inset: -6rem -10rem auto;
  height: 42rem;
  z-index: -1;
  pointer-events: none;
  filter: blur(70px);
  opacity: 0.55;
}

.hero-glow span {
  position: absolute;
  border-radius: 9999px;
  animation: drift 18s ease-in-out infinite alternate;
}

.hero-glow span:first-child {
  width: 28rem;
  height: 28rem;
  right: 8%;
  top: 2rem;
  background: #bfdbfe;
}

.hero-glow span:last-child {
  width: 22rem;
  height: 22rem;
  right: 30%;
  top: 14rem;
  background: #a5f3fc;
  animation-duration: 22s;
  animation-delay: -6s;
}

@keyframes drift {
  to {
    transform: translate3d(-4rem, 3rem, 0) scale(1.12);
  }
}

.hero-figure {
  animation: rise 0.9s 0.2s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(28px) scale(0.98);
  }
}

.replay {
  opacity: 0;
  animation: show 0.4s 3.4s ease forwards;
}

@keyframes show {
  to {
    opacity: 1;
  }
}
</style>
