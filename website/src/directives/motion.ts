import type { Directive } from 'vue'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * v-reveal: fades and lifts an element into place the first time it scrolls
 * into view. Optional value = delay in ms (for small staggers inside a group).
 */
export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (reducedMotion() || !('IntersectionObserver' in window)) return
    el.classList.add('reveal')
    if (binding.value) el.style.transitionDelay = `${binding.value}ms`
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('is-visible')
            io.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    )
    io.observe(el)
    ;(el as any).__reveal = io
  },
  beforeUnmount(el) {
    ;(el as any).__reveal?.disconnect()
  },
}

/**
 * v-tilt: a gentle 3D tilt and highlight that follows the pointer, for product
 * screenshots. Disabled for touch input and reduced motion.
 */
export const vTilt: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (reducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const max = binding.value ?? 4
    let frame = 0
    el.classList.add('tilt')

    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--tilt-x', `${(-y * max).toFixed(2)}deg`)
        el.style.setProperty('--tilt-y', `${(x * max).toFixed(2)}deg`)
        el.style.setProperty('--glow-x', `${((x + 0.5) * 100).toFixed(1)}%`)
        el.style.setProperty('--glow-y', `${((y + 0.5) * 100).toFixed(1)}%`)
      })
    }
    const leave = () => {
      cancelAnimationFrame(frame)
      el.style.setProperty('--tilt-x', '0deg')
      el.style.setProperty('--tilt-y', '0deg')
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    ;(el as any).__tilt = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  },
  beforeUnmount(el) {
    ;(el as any).__tilt?.()
  },
}

declare module 'vue' {
  interface GlobalDirectives {
    vReveal: typeof vReveal
    vTilt: typeof vTilt
  }
}
