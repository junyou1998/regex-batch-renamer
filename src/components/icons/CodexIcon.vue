<script setup lang="ts">
withDefaults(
  defineProps<{
    className?: string
  }>(),
  {
    className: 'w-5 h-5',
  }
)
</script>

<template>
  <svg
    role="img"
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :class="className"
  >
    <title>Codex CLI</title>
    <defs>
      <linearGradient id="codexGradient" x1="8" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#A594FD" />
        <stop offset="45%" stop-color="#7071F8" />
        <stop offset="100%" stop-color="#3B5BFA" />
      </linearGradient>
    </defs>
    <!-- Cloud / Flower Bubble -->
    <path
      d="M16 3.8C18.1 3.8 20 4.9 21 6.8C22.8 6.5 24.6 7.4 25.5 9C26.5 10.6 26.3 12.7 25.1 14.2C26.6 15.6 27.1 17.8 26.2 19.6C25.2 21.4 23.2 22.5 21.1 22.3C20 24 18 25 15.9 24.9C13.8 24.8 12 23.6 11.1 21.9C9.1 22.2 7.2 21.1 6.3 19.3C5.4 17.5 6 15.3 7.5 14C6.4 12.5 6.4 10.5 7.3 9C8.3 7.4 10.1 6.6 11.9 7C12.9 5.2 14.8 3.8 16 3.8Z"
      fill="url(#codexGradient)"
    />
    <!-- Command Prompt > _ -->
    <path
      d="M11 11.5L14.5 15.5L11 19.5"
      stroke="white"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M17.5 19.5H21.5"
      stroke="white"
      stroke-width="2.4"
      stroke-linecap="round"
    />
  </svg>
</template>
