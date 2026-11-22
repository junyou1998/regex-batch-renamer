<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { screenshotLang } from '../i18n'
import ZoomableShot from './ZoomableShot.vue'

const { locale } = useI18n()

const ROWS = [
  { key: 'preview', shot: 'docs', points: 3 },
  { key: 'safe', shot: 'history', points: 3 },
  { key: 'ai', shot: 'ai', points: 3 },
  { key: 'plugins', shot: 'plugins', points: 3 },
] as const

const dir = computed(() => screenshotLang(locale.value))
</script>

<template>
  <section id="features" class="mx-auto max-w-6xl scroll-mt-20 px-5 py-24 sm:px-8" aria-labelledby="features-title">
    <h2 v-reveal id="features-title" class="max-w-2xl text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{{ $t('features.title') }}</h2>
    <p v-reveal="80" class="mt-4 max-w-2xl text-lg leading-relaxed text-slate">{{ $t('features.lede') }}</p>

    <div class="mt-16 space-y-24">
      <article v-for="(row, i) in ROWS" :key="row.key"
        class="grid items-center gap-10 lg:grid-cols-12">
        <div v-reveal class="lg:col-span-5" :class="i % 2 === 1 ? 'lg:order-2 lg:col-start-8' : ''">
          <h3 class="text-2xl font-semibold tracking-[-0.015em]">{{ $t(`features.${row.key}.title`) }}</h3>
          <p class="mt-4 text-[17px] leading-relaxed text-slate">{{ $t(`features.${row.key}.body`) }}</p>
          <ul class="mt-6 space-y-3">
            <li v-for="n in row.points" :key="n" v-reveal="120 + n * 90" class="flex gap-3 text-[15px] leading-relaxed">
              <svg class="mt-1 h-4 w-4 shrink-0 text-added" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" /></svg>
              <span>{{ $t(`features.${row.key}.p${n}`) }}</span>
            </li>
          </ul>
        </div>
        <div v-reveal="150" class="lg:col-span-7" :class="i % 2 === 1 ? 'lg:order-1 lg:col-start-1' : ''">
          <ZoomableShot :src="`/screenshots/${dir}/${row.shot}.webp`" :alt="$t(`features.${row.key}.alt`)" />
        </div>
      </article>
    </div>
  </section>
</template>
