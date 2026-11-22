import type { Directive, DirectiveBinding } from 'vue'

/**
 * `v-tooltip` — a styled tooltip that replaces the browser's plain `title`.
 *
 *   v-tooltip="'Short label'"
 *   v-tooltip="{ title: 'Regex', desc: 'Match with a regular expression', shortcut: '⌘ R', placement: 'bottom' }"
 *
 * One shared tooltip element lives in <body>, so it is never clipped by a
 * scrolling container. It appears after a short delay on hover or keyboard
 * focus, prefers the requested side and flips when there is no room.
 */

export interface TooltipOptions {
  title: string
  desc?: string
  /** Current state of a toggle, e.g. "On — ignoring case". */
  status?: string
  /** Colours the status dot: true = on (blue), false = off (grey). */
  statusOn?: boolean
  shortcut?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  disabled?: boolean
}

type TooltipValue = string | TooltipOptions | null | undefined

interface TooltipHost extends HTMLElement {
  __tooltip?: { options: TooltipOptions | null; cleanup: () => void }
}

const SHOW_DELAY = 350
const GAP = 8

let tipEl: HTMLDivElement | null = null
let showTimer: ReturnType<typeof setTimeout> | null = null
let activeHost: TooltipHost | null = null

function normalize(value: TooltipValue): TooltipOptions | null {
  if (!value) return null
  if (typeof value === 'string') return value.trim() ? { title: value } : null
  return value.title?.trim() && !value.disabled ? value : null
}

function ensureTip(): HTMLDivElement {
  if (tipEl) return tipEl
  tipEl = document.createElement('div')
  tipEl.setAttribute('role', 'tooltip')
  tipEl.id = 'app-tooltip'
  tipEl.className =
    'app-tooltip pointer-events-none fixed z-[100001] max-w-[260px] rounded-lg bg-slate-900/95 dark:bg-slate-700/95 ' +
    'px-2.5 py-1.5 text-caption leading-snug text-white shadow-xl ring-1 ring-white/10 backdrop-blur-sm [overflow-wrap:anywhere] ' +
    'opacity-0 transition-opacity duration-100'
  document.body.appendChild(tipEl)
  return tipEl
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function render(options: TooltipOptions) {
  const el = ensureTip()
  const shortcut = options.shortcut
    ? `<kbd class="ml-2 shrink-0 rounded border border-white/20 bg-white/10 px-1 font-mono text-meta text-slate-200">${escapeHtml(options.shortcut)}</kbd>`
    : ''
  const status = options.status
    ? `<div class="mt-1 flex items-center gap-1.5 text-caption font-medium ${options.statusOn ? 'text-sky-300' : 'text-slate-300'}">` +
      `<span class="inline-block h-1.5 w-1.5 shrink-0 rounded-full ${options.statusOn ? 'bg-sky-400' : 'bg-slate-500'}"></span>${escapeHtml(options.status)}</div>`
    : ''
  const desc = options.desc ? `<div class="mt-0.5 text-caption text-slate-300">${escapeHtml(options.desc)}</div>` : ''
  el.innerHTML = `<div class="flex items-center justify-between font-semibold"><span>${escapeHtml(options.title)}</span>${shortcut}</div>${status}${desc}`
}

function place(host: HTMLElement, preferred: TooltipOptions['placement'] = 'top') {
  const el = ensureTip()
  const r = host.getBoundingClientRect()
  const tw = el.offsetWidth
  const th = el.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight

  const fits = {
    top: r.top - th - GAP >= 4,
    bottom: r.bottom + th + GAP <= vh - 4,
    left: r.left - tw - GAP >= 4,
    right: r.right + tw + GAP <= vw - 4,
  }
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const
  const side = fits[preferred] ? preferred : fits[opposite[preferred]] ? opposite[preferred] : 'top'

  let left: number
  let top: number
  if (side === 'top' || side === 'bottom') {
    left = r.left + r.width / 2 - tw / 2
    top = side === 'top' ? r.top - th - GAP : r.bottom + GAP
  } else {
    top = r.top + r.height / 2 - th / 2
    left = side === 'left' ? r.left - tw - GAP : r.right + GAP
  }
  el.style.left = `${Math.round(Math.min(Math.max(4, left), vw - tw - 4))}px`
  el.style.top = `${Math.round(Math.min(Math.max(4, top), vh - th - 4))}px`
}

function show(host: TooltipHost) {
  const options = host.__tooltip?.options
  if (!options) return
  activeHost = host
  render(options)
  const el = ensureTip()
  el.style.opacity = '0'
  el.style.display = 'block'
  place(host, options.placement)
  host.setAttribute('aria-describedby', el.id)
  requestAnimationFrame(() => {
    if (activeHost === host) el.style.opacity = '1'
  })
}

function hide() {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
  if (activeHost) activeHost.removeAttribute('aria-describedby')
  activeHost = null
  if (tipEl) {
    tipEl.style.opacity = '0'
    tipEl.style.display = 'none'
  }
}

function schedule(host: TooltipHost) {
  if (showTimer) clearTimeout(showTimer)
  // Moving between tooltipped controls feels instant once one is visible.
  const delay = activeHost ? 0 : SHOW_DELAY
  showTimer = setTimeout(() => show(host), delay)
}

if (typeof window !== 'undefined') {
  window.addEventListener('scroll', hide, true)
  window.addEventListener('blur', hide)
}

function bind(el: TooltipHost, binding: DirectiveBinding<TooltipValue>) {
  const options = normalize(binding.value)
  // Keep an accessible name without the native tooltip popping up as well.
  el.removeAttribute('title')
  if (options && !el.getAttribute('aria-label') && !el.textContent?.trim()) {
    el.setAttribute('aria-label', options.title)
  }

  const onEnter = () => schedule(el)
  const onLeave = () => hide()
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide()
  // Toggle buttons keep their tooltip on click so the status line updates live.
  const onPress = () => {
    if (!el.hasAttribute('aria-pressed')) hide()
  }
  el.addEventListener('mouseenter', onEnter)
  el.addEventListener('mouseleave', onLeave)
  el.addEventListener('focusin', onEnter)
  el.addEventListener('focusout', onLeave)
  el.addEventListener('pointerdown', onPress)
  el.addEventListener('keydown', onKey)

  el.__tooltip = {
    options,
    cleanup: () => {
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('focusin', onEnter)
      el.removeEventListener('focusout', onLeave)
      el.removeEventListener('pointerdown', onPress)
      el.removeEventListener('keydown', onKey)
    },
  }
}

export const vTooltip: Directive<TooltipHost, TooltipValue> = {
  mounted: bind,
  updated(el, binding) {
    const options = normalize(binding.value)
    if (el.__tooltip) el.__tooltip.options = options
    el.removeAttribute('title')
    if (activeHost === el) {
      if (options) {
        render(options)
        place(el, options.placement)
      } else {
        hide()
      }
    }
  },
  beforeUnmount(el) {
    if (activeHost === el) hide()
    el.__tooltip?.cleanup()
    delete el.__tooltip
  },
}

declare module 'vue' {
  interface GlobalDirectives {
    vTooltip: typeof vTooltip
  }
}
