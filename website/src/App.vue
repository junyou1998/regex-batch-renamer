<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

const languages = [
  { code: 'en', name: 'English' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'zh-CN', name: '简体中文' }
] as const

const currentLang = ref(locale.value)
const showLangMenu = ref(false)
const langMenuContainer = ref<HTMLElement | null>(null)

function handleClickOutside(event: MouseEvent) {
  if (showLangMenu.value && langMenuContainer.value && !langMenuContainer.value.contains(event.target as Node)) {
    showLangMenu.value = false
  }
}

function setLanguage(code: string) {
  locale.value = code
  currentLang.value = code
  localStorage.setItem('user-locale', code)
  showLangMenu.value = false
}


onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  const savedLocale = localStorage.getItem('user-locale')
  if (savedLocale && languages.some(l => l.code === savedLocale)) {
    setLanguage(savedLocale)
  } else {
    const userLang = navigator.language
    if (userLang.includes('zh-TW') || userLang.includes('zh-HK') || userLang.includes('zh-MO')) {
      setLanguage('zh-TW')
    } else if (userLang.includes('zh')) {
      setLanguage('zh-CN')
    } else {
      setLanguage('en')
    }
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const currentLangInfo = computed(() => {
  return languages.find(l => l.code === currentLang.value) ?? languages[0]
})


const latestVersion = ref('')
const downloadLinks = ref({
  macUniversal: '',
  macArm: '',
  macIntel: '',
  windows: '',
  linux: '',
  all: 'https://github.com/junyou1998/regex-batch-renamer/releases'
})
const githubUrl = 'https://github.com/junyou1998/regex-batch-renamer'

onMounted(async () => {
  try {
    const response = await fetch('https://api.github.com/repos/junyou1998/regex-batch-renamer/releases/latest')
    if (!response.ok) return

    const data = await response.json()
    latestVersion.value = data.tag_name

    downloadLinks.value.all = data.html_url


    const assets = data.assets as Array<{ name: string; browser_download_url: string }>

    const findAsset = (pattern: RegExp) => assets.find(a => pattern.test(a.name))?.browser_download_url



    const universal = findAsset(/universal\.dmg$/i)
    const macArm = findAsset(/arm64\.dmg$/i)
    const macIntel = findAsset(/x64\.dmg$/i) || assets.find(a => /\.dmg$/i.test(a.name) && !/arm64/i.test(a.name) && !/universal/i.test(a.name))?.browser_download_url
    const windows = findAsset(/\.exe$/i)
    const linux = findAsset(/\.AppImage$/i)

    if (universal) downloadLinks.value.macUniversal = universal
    if (macArm) downloadLinks.value.macArm = macArm
    if (macIntel) downloadLinks.value.macIntel = macIntel
    if (windows) downloadLinks.value.windows = windows
    if (linux) downloadLinks.value.linux = linux
  } catch (e) {
    console.error('Failed to fetch latest release:', e)
  }
})
</script>

<template>
  <div class="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 font-sans text-slate-900">
    <!-- Header -->
    <header class="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
      <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="/app-icon.png" alt="Logo" class="w-10 h-10 rounded-xl shadow-lg shadow-blue-500/20" />
          <span class="text-xl font-bold bg-linear-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            {{ t('app.title') }}
          </span>
        </div>

        <!-- Language Switcher -->
        <div class="relative" ref="langMenuContainer">
          <button @click="showLangMenu = !showLangMenu"
            class="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-sm font-medium text-slate-700 cursor-pointer">
            <span>{{ currentLangInfo.name }}</span>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div v-if="showLangMenu"
            class="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-2 animate-fade-in z-50">
            <button v-for="lang in languages" :key="lang.code" @click="setLanguage(lang.code)" :class="[
              'w-full px-4 py-2 text-left text-sm hover:bg-slate-100 transition-colors flex items-center gap-3 cursor-pointer',
              currentLang === lang.code ? 'text-blue-600 font-medium' : 'text-slate-700'
            ]">
              <span>{{ lang.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="relative overflow-hidden py-20 lg:py-32">
      <div class="absolute inset-0 bg-linear-to-br from-blue-500/5 via-transparent to-cyan-500/5 pointer-events-none">
      </div>
      <div class="max-w-6xl mx-auto px-6 relative">
        <div class="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          <div class="space-y-8 animate-slide-up lg:col-span-5">
            <div v-if="latestVersion"
              class="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              <span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              {{ latestVersion }} Released
            </div>
            <h1 class="text-4xl lg:text-6xl font-bold text-slate-900 leading-tight">
              {{ t('hero.headline') }}
            </h1>
            <p class="text-xl text-slate-600">
              {{ t('hero.subheadline') }}
            </p>
            <div class="flex flex-wrap gap-4">
              <a href="#download"
                class="inline-flex items-center gap-2 px-8 py-4 bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-600/40 transition-all hover:-translate-y-0.5 cursor-pointer">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {{ t('hero.cta') }}
              </a>
              <a href="#features"
                class="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-semibold border border-slate-300 transition-all hover:-translate-y-0.5 cursor-pointer">
                {{ t('hero.learnMore') }}
              </a>
            </div>
          </div>

          <div class="relative animate-slide-in-right lg:col-span-7">
            <div
              class="absolute -inset-4 bg-linear-to-r from-blue-500/20 to-cyan-500/20 rounded-3xl blur-3xl transform lg:scale-110">
            </div>
            <div
              class="relative rounded-sm md:rounded-lg lg:rounded-2xl shadow-2xl ring-1 ring-slate-900/5 lg:w-[140%] lg:max-w-none hover:scale-[1.02] transition-transform duration-500 overflow-hidden bg-slate-50">
              <img src="/screenshot.png" alt="Regex Batch Renamer Screenshot" class="w-full scale-[1.01]">
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-20 bg-white">
      <div class="max-w-6xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-3xl lg:text-4xl font-bold text-slate-900">{{ t('features.title') }}</h2>
          <p class="mt-4 text-slate-600 max-w-2xl mx-auto">{{ t('features.subtitle') }}</p>
        </div>

        <div class="grid md:grid-cols-3 gap-8">
          <!-- Batch -->
          <div
            class="group p-8 rounded-2xl bg-linear-to-br from-slate-50 to-white border border-slate-200 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10 transition-all">
            <div
              class="w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/30">
              <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-slate-900 mb-4">{{ t('features.batch.title') }}</h3>
            <p class="text-slate-600 leading-relaxed">{{ t('features.batch.description') }}</p>
          </div>

          <!-- Preview -->
          <div
            class="group p-8 rounded-2xl bg-linear-to-br from-slate-50 to-white border border-slate-200 hover:border-cyan-300 hover:shadow-xl hover:shadow-cyan-500/10 transition-all">
            <div
              class="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-500 to-cyan-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-cyan-500/30">
              <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-slate-900 mb-4">{{ t('features.preview.title') }}</h3>
            <p class="text-slate-600 leading-relaxed">{{ t('features.preview.description') }}</p>
          </div>

          <!-- Open Source -->
          <div
            class="group p-8 rounded-2xl bg-linear-to-br from-slate-50 to-white border border-slate-200 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-500/10 transition-all">
            <div
              class="w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/30">
              <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 class="text-2xl font-bold text-slate-900 mb-4">{{ t('features.opensource.title') }}</h3>
            <p class="text-slate-600 leading-relaxed">{{ t('features.opensource.description') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Download Section -->
    <section id="download" class="py-20 bg-slate-900 text-white relative overflow-hidden">
      <div class="absolute inset-0 bg-linear-to-br from-blue-900/20 to-purple-900/20"></div>
      <div class="max-w-6xl mx-auto px-6 text-center relative z-10">
        <h2 class="text-3xl lg:text-4xl font-bold mb-4">{{ t('download.title') }}</h2>
        <p class="text-slate-400 mb-12 text-lg max-w-2xl mx-auto">{{ t('download.description') }}</p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
          <!-- macOS Universal -->
          <a v-if="downloadLinks.macUniversal" :href="downloadLinks.macUniversal"
            class="group flex flex-col items-center gap-3 p-6 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer">
            <svg class="w-12 h-12 text-white group-hover:text-blue-400 transition-colors" viewBox="0 0 24 24"
              fill="currentColor">
              <path
                d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
            </svg>
            <div class="text-center">
              <div class="font-bold text-lg">{{ t('download.macos') }}</div>
              <div class="text-xs text-slate-400 mt-1">Universal (Intel & Apple Silicon)</div>
            </div>
            <div class="mt-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">.dmg</div>
          </a>

          <!-- macOS Arm64 (Only show if no universal) -->
          <a v-if="!downloadLinks.macUniversal && downloadLinks.macArm" :href="downloadLinks.macArm"
            class="group flex flex-col items-center gap-3 p-6 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer">
            <svg class="w-12 h-12 text-white group-hover:text-blue-400 transition-colors" viewBox="0 0 24 24"
              fill="currentColor">
              <path
                d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
            </svg>
            <div class="text-center">
              <div class="font-bold text-lg">{{ t('download.macos') }}</div>
              <div class="text-xs text-slate-400 mt-1">Apple Silicon (M1/M2/M3)</div>
            </div>
            <div class="mt-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">.dmg</div>
          </a>

          <!-- macOS Intel (Only show if no universal) -->
          <a v-if="!downloadLinks.macUniversal && downloadLinks.macIntel" :href="downloadLinks.macIntel"
            class="group flex flex-col items-center gap-3 p-6 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer">
            <svg class="w-12 h-12 text-white group-hover:text-blue-400 transition-colors" viewBox="0 0 24 24"
              fill="currentColor">
              <path
                d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
            </svg>
            <div class="text-center">
              <div class="font-bold text-lg">{{ t('download.macosIntel') }}</div>
              <div class="text-xs text-slate-400 mt-1">Intel Chip</div>
            </div>
            <div class="mt-2 text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">.dmg</div>
          </a>

          <!-- Windows -->
          <a v-if="downloadLinks.windows" :href="downloadLinks.windows"
            class="group flex flex-col items-center gap-3 p-6 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer">
            <svg class="w-12 h-12 text-white group-hover:text-cyan-400 transition-colors" viewBox="0 0 24 24"
              fill="currentColor">
              <path d="M0,0H11.377V11.372H0ZM12.623,0H24V11.372H12.623ZM0,12.623H11.377V24H0Zm12.623,0H24V24H12.623" />
            </svg>
            <div class="text-center">
              <div class="font-bold text-lg">{{ t('download.windows') }}</div>
              <div class="text-xs text-slate-400 mt-1">Windows 10/11</div>
            </div>
            <div class="mt-2 text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded">.exe</div>
          </a>



          <!-- Linux -->
          <a v-if="downloadLinks.linux" :href="downloadLinks.linux"
            class="group flex flex-col items-center gap-3 p-6 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all hover:-translate-y-1 hover:shadow-2xl cursor-pointer">
            <svg class="w-12 h-12 text-white group-hover:text-yellow-400 transition-colors" viewBox="0 0 24 24"
              fill="currentColor">
              <path
                d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35-1.5 1.072-3.58 1.538-5.348.334a2.645 2.645 0 00-.402-.533 1.45 1.45 0 00-.275-.333c.182 0 .338-.03.465-.067a.615.615 0 00.314-.334c.108-.267 0-.697-.345-1.163-.345-.467-.931-.995-1.788-1.521-.63-.4-.986-.87-1.15-1.396-.165-.534-.143-1.085-.015-1.645.245-1.07.873-2.11 1.274-2.763.107-.065.037.135-.408.974-.396.751-1.14 2.497-.122 3.854a8.123 8.123 0 01.647-2.876c.564-1.278 1.743-3.504 1.836-5.268.048.036.217.135.289.202.218.133.38.333.59.465.21.201.477.335.876.335.039.003.075.006.11.006.412 0 .73-.134.997-.268.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876.085.4.154.78.409 1.066.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595-.63.401-1.746.712-2.457 1.57-.618.737-1.37 1.14-2.036 1.191-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69.176-.668.428-1.344.463-1.897.037-.714.076-1.335.195-1.814.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01c.053 0 .105.005.157.014.376.055.706.333 1.023.752l.91 1.664.003.003c.243.533.754 1.064 1.189 1.637.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294-.645.135-1.52.002-2.395-.464-.968-.536-2.118-.469-2.857-.602-.369-.066-.61-.2-.723-.4-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118-.055-.401-.083-.71.043-.94.16-.334.396-.4.69-.533.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838.19-.201.38-.336.663-.336zm7.159-9.074c-.435.201-.945.535-1.488.535-.542 0-.97-.267-1.28-.466-.154-.134-.28-.268-.373-.335-.164-.134-.144-.333-.074-.333.109.016.129.134.199.2.096.066.215.2.36.333.292.2.68.467 1.167.467.485 0 1.053-.267 1.398-.466.195-.135.445-.334.648-.467.156-.136.149-.267.279-.267.128.016.034.134-.147.332a8.097 8.097 0 01-.69.468zm-1.082-1.583V5.64c-.006-.02.013-.042.029-.05.074-.043.18-.027.26.004.063 0 .16.067.15.135-.006.049-.085.066-.135.066-.055 0-.092-.043-.141-.068-.052-.018-.146-.008-.163-.065zm-.551 0c-.02.058-.113.049-.166.066-.047.025-.086.068-.14.068-.05 0-.13-.02-.136-.068-.01-.066.088-.133.15-.133.08-.031.184-.047.259-.005.019.009.036.03.05v.02h.003z" />
            </svg>
            <div class="text-center">
              <div class="font-bold text-lg">{{ t('download.linux') }}</div>
              <div class="text-xs text-slate-400 mt-1">AppImage / Deb</div>
            </div>
            <div class="mt-2 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">.AppImage</div>
          </a>
        </div>

        <a :href="downloadLinks.all" target="_blank"
          class="inline-flex items-center gap-2 mt-12 text-slate-400 hover:text-white transition-colors cursor-pointer border-b border-transparent hover:border-white pb-0.5">
          {{ t('download.viewAll') }}
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="py-12 bg-slate-900 border-t border-slate-800 text-sm">
      <div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex flex-col md:flex-row items-center gap-4 md:gap-8">
          <span class="text-slate-500 font-medium">© 2026 Regex Batch Renamer.</span>
          <div class="flex items-center gap-6">
            <a :href="githubUrl" target="_blank"
              class="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fill-rule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.981 1.029-2.68-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.587 1.028 2.68 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  clip-rule="evenodd" />
              </svg>
              GitHub
            </a>
            <a :href="downloadLinks.all" target="_blank" class="text-slate-400 hover:text-white transition-colors">
              {{ t('footer.releases') }}
            </a>
          </div>
        </div>
        <div class="flex items-center gap-6">
          <a href="https://www.buymeacoffee.com/junyou" target="_blank"
            class="text-slate-400 hover:text-yellow-400 transition-colors flex items-center gap-2 group">
            <svg class="w-4 h-4 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M20.216 6.415l-.132-.666c-.119-.596-.385-1.135-.77-1.566-.694-.776-1.748-1.183-2.912-1.183H5.539c-1.636 0-3.031.785-3.66 2.05-.33.666-.464 1.436-.375 2.222l.509 4.41c.21 1.82 1.458 3.376 3.195 3.978.868 2.628 3.327 4.545 6.255 4.545 3.018 0 5.538-2.037 6.34-4.8 1.58-.28 2.872-1.464 3.257-3.01.272-1.096.26-2.225-.04-3.295l-.16-.6c-.235-.867-.714-1.623-1.385-2.185zM6.69 7.042h8.04l-.36 3.14H6.33l.36-3.14zm9.32 4.14v-5.14h.024c.778 0 1.474.253 1.954.717.378.367.636.852.73 1.37l.035.205c.189.924.088 1.868-.282 2.66-.525 1.118-1.554 1.865-2.783 2.01l.322-1.822z" />
            </svg>
            Buy me a coffee
          </a>
          <span class="text-slate-600">Created by <a href="https://github.com/junyou1998" target="_blank"
              class="text-slate-400 hover:text-blue-400 transition-colors">JunYou</a></span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slide-in-right {
  from {
    opacity: 0;
    transform: translateX(20px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

.animate-slide-up {
  animation: slide-up 0.8s ease-out;
}

.animate-slide-in-right {
  animation: slide-in-right 0.8s ease-out 0.2s backwards;
}
</style>
