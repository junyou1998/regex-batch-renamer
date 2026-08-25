<script setup lang="ts">
defineProps<{
  className?: string
}>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    :class="className || 'w-4 h-4'"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="24" height="24" rx="5" class="fill-slate-900 dark:fill-slate-100" />
    <path
      d="M6.5 17.5L11.2 11.2L6.8 6.5H9.2L12.3 9.9L15.6 6.5H17.5L12.8 11.8L17.5 17.5H15.1L11.7 13.1L8.4 17.5H6.5Z"
      class="fill-white dark:fill-slate-900"
    />
  </svg>
</template>
