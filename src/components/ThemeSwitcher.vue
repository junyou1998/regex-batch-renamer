<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { useThemeStore, type ThemeMode } from '../stores/themeStore'
import { useI18n } from 'vue-i18n'
import { Monitor, Moon, Sun } from 'lucide-vue-next'

const themeStore = useThemeStore()
const { t } = useI18n()


async function cycleTheme(event: MouseEvent) {
    const modes: ThemeMode[] = ['auto', 'light', 'dark']
    const currentIndex = modes.indexOf(themeStore.themeMode)
    const nextIndex = (currentIndex + 1) % modes.length
    const nextTheme = modes[nextIndex]

    const isAppearanceTransition = 'startViewTransition' in document
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!isAppearanceTransition) {
        themeStore.setTheme(nextTheme)
        return
    }

    const x = event.clientX
    const y = event.clientY
    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    )

    const html = document.documentElement
    const isDark = html.classList.contains('dark')

    html.setAttribute('data-vt-from', isDark ? 'dark' : 'light')

    const transition = document.startViewTransition(async () => {
        themeStore.setTheme(nextTheme)
        await nextTick()
    })

    await transition.ready

    const createWavyPolygon = (radius: number, waveCount: number = 8, waveAmp: number = 0.08) => {
        const points = []
        const steps = 100
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * 2 * Math.PI
            const r = radius * (1 + waveAmp * Math.sin(angle * waveCount))
            const px = x + r * Math.cos(angle)
            const py = y + r * Math.sin(angle)
            points.push(`${px.toFixed(1)}px ${py.toFixed(1)}px`)
        }
        return `polygon(${points.join(', ')})`
    }


    const clipPathStart = createWavyPolygon(0)

    const clipPathEnd = createWavyPolygon(endRadius * 1.5)



    const expand = [clipPathStart, clipPathEnd]

    const collapse = [clipPathEnd, clipPathStart]

    if (isDark) {
        document.documentElement.animate(
            { clipPath: collapse },
            {
                duration: 600,
                easing: 'ease-in-out',
                pseudoElement: '::view-transition-old(root)'
            }
        )
    } else {
        document.documentElement.animate(
            { clipPath: expand },
            {
                duration: 600,
                easing: 'ease-in-out',
                pseudoElement: '::view-transition-new(root)'
            }
        )
    }


    transition.finished.finally(() => {
        html.removeAttribute('data-vt-from')
    })
}


const themeTooltip = computed(() => {
    switch (themeStore.themeMode) {
        case 'auto': return t('theme.auto')
        case 'light': return t('theme.light')
        case 'dark': return t('theme.dark')
    }
})
</script>

<template>
    <button @click="cycleTheme" :title="themeTooltip"
        class="p-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
        <Monitor v-if="themeStore.themeMode === 'auto'" class="w-5 h-5" />
        <Sun v-else-if="themeStore.themeMode === 'light'" class="w-5 h-5" />
        <Moon v-else class="w-5 h-5" />
    </button>
</template>
