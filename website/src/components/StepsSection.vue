<template>
  <section class="border-y border-line bg-white" aria-labelledby="steps-title">
    <div class="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <h2 id="steps-title" class="text-3xl font-semibold tracking-[-0.02em]">{{ $t('steps.title') }}</h2>
      <ol class="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="n in 4" :key="n" class="relative pl-12">
          <span class="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-ink font-mono text-sm text-white" aria-hidden="true">{{ n }}</span>
          <h3 class="font-semibold">{{ $t(`steps.s${n}.title`) }}</h3>
          <p class="mt-2 text-[15px] leading-relaxed text-slate">{{ $t(`steps.s${n}.body`) }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>
