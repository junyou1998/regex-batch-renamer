<template>
  <section class="border-y border-line bg-white" aria-labelledby="steps-title">
    <div class="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <h2 v-reveal id="steps-title" class="text-3xl font-semibold tracking-[-0.02em]">{{ $t('steps.title') }}</h2>
      <ol v-reveal class="steps relative mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="n in 4" :key="n" class="step relative pl-12 lg:pl-0 lg:pt-14" :style="{ '--i': n }">
          <span class="step-dot absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-ink font-mono text-sm text-white" aria-hidden="true">{{ n }}</span>
          <h3 class="font-semibold">{{ $t(`steps.s${n}.title`) }}</h3>
          <p class="mt-2 text-[15px] leading-relaxed text-slate">{{ $t(`steps.s${n}.body`) }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
/* On wide screens a line connects the steps and draws in when the list appears. */
@media (min-width: 1024px) {
  .steps::before {
    content: '';
    position: absolute;
    top: 1rem;
    left: 2.25rem;
    right: calc(25% - 2.5rem);
    height: 2px;
    background: linear-gradient(90deg, var(--color-signal), #22d3ee);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 1.2s cubic-bezier(0.2, 0.7, 0.2, 1) 0.2s;
    z-index: 0;
  }

  .steps.is-visible::before {
    transform: scaleX(1);
  }
}

.step-dot {
  z-index: 1;
  transition: transform 0.4s cubic-bezier(0.3, 1.6, 0.5, 1) calc(var(--i) * 0.18s), background-color 0.4s ease calc(var(--i) * 0.18s);
}

.steps.reveal:not(.is-visible) .step-dot {
  transform: scale(0.6);
}

.steps.is-visible .step-dot {
  background-color: var(--color-signal);
}
</style>
