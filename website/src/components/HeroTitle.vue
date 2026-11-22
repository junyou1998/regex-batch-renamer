<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * The headline renames itself, the way you rename a file in Finder:
 * the messy tail gets selected, deleted, and the real ending is typed in.
 *
 *   一次更名上百個檔案▕ (1) 最終版_v2.txt▏ → 一次更名上百個檔案，改之前先看清楚。
 */
const { t, locale } = useI18n()

type Phase = 'idle' | 'select' | 'delete' | 'type' | 'done'
const phase = ref<Phase>('idle')
const typed = ref('')
const timers: number[] = []

const start = computed(() => t('hero.titleStart'))
const noise = computed(() => t('hero.titleNoise'))
const end = computed(() => t('hero.titleEnd'))
const full = computed(() => start.value + end.value)

function clearTimers() {
  timers.splice(0).forEach((id) => clearTimeout(id))
}

function at(ms: number, fn: () => void) {
  timers.push(window.setTimeout(fn, ms))
}

function play() {
  clearTimers()
  typed.value = ''
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    phase.value = 'done'
    return
  }
  phase.value = 'idle'
  at(650, () => (phase.value = 'select'))
  at(1250, () => (phase.value = 'delete'))
  at(1600, () => {
    phase.value = 'type'
    const chars = Array.from(end.value)
    const step = Math.max(28, Math.min(55, 1100 / chars.length))
    chars.forEach((_, i) => at(i * step, () => (typed.value = chars.slice(0, i + 1).join(''))))
    at(chars.length * step + 450, () => (phase.value = 'done'))
  })
}

onMounted(play)
watch(locale, play)
onBeforeUnmount(clearTimers)

defineExpose({ play })
</script>

<template>
  <h1 class="hero-title" :class="`is-${phase}`" :aria-label="full">
    <span aria-hidden="true" class="hero-title__field">
      <span>{{ start }}</span>
      <span v-if="phase === 'idle' || phase === 'select' || phase === 'delete'" class="hero-title__noise">{{ noise }}</span>
      <span v-if="phase === 'type'">{{ typed }}</span>
      <span v-if="phase === 'done'" class="hero-title__end">{{ end }}</span>
      <span v-if="phase !== 'done'" class="hero-title__caret" />
    </span>
  </h1>
</template>

<style scoped>
.hero-title {
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.12;
}

/* While renaming, the headline sits in a soft "name field" like Finder's. */
.hero-title__field {
  border-radius: 14px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  padding: 0.04em 0.18em;
  margin-left: -0.18em;
  transition: background-color 0.5s ease, box-shadow 0.5s ease;
}

.hero-title:not(.is-done) .hero-title__field {
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 0 1.5px rgba(37, 99, 235, 0.35), 0 12px 30px -16px rgba(37, 99, 235, 0.45);
}

.hero-title__noise {
  color: var(--color-slate);
  font-family: var(--font-mono);
  font-size: 0.62em;
  font-weight: 500;
  letter-spacing: 0;
  border-radius: 6px;
  transition: background-color 0.25s ease, color 0.25s ease;
}

/* Selected text, like a system text selection. */
.is-select .hero-title__noise,
.is-delete .hero-title__noise {
  background: #bfdbfe;
  color: var(--color-ink);
}

.is-delete .hero-title__noise {
  animation: delete 0.32s ease-in forwards;
}

.hero-title__caret {
  display: inline-block;
  width: 3px;
  height: 0.92em;
  margin-left: 2px;
  vertical-align: -0.1em;
  border-radius: 2px;
  background: var(--color-signal);
  animation: blink 1s steps(1) infinite;
}

.is-type .hero-title__caret {
  animation: none;
}

/* A brief green flash confirms the rename, like the app's "added" diff colour. */
.hero-title__end {
  border-radius: 8px;
  animation: renamed 1.4s ease-out;
}

@keyframes renamed {
  0% {
    background-color: var(--color-added-bg);
  }
  100% {
    background-color: transparent;
  }
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@keyframes delete {
  to {
    opacity: 0;
    letter-spacing: -0.6em;
    font-size: 0;
  }
}
</style>
