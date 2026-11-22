import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import i18n from './i18n'
import { vTooltip } from './directives/tooltip'
import { prepareDemoScene } from './dev/demoScenes'

if (import.meta.env.VITE_DEMO_MODE === '1') {
  prepareDemoScene()
}

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.directive('tooltip', vTooltip)
app.mount('#app')

if (import.meta.env.VITE_DEMO_MODE === '1') {
  void Promise.all([import('./dev/demoBridge'), import('./stores/fileStore'), import('./dev/demoScenes')]).then(async ([demo, files, scenes]) => {
    const initial = demo.demoInitialFiles()
    if (initial.length > 0) files.useFileStore().addFilePaths(initial)
    await scenes.runDemoScene()
  })
}
