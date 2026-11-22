import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import i18n from './i18n'

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.mount('#app')

if (import.meta.env.VITE_DEMO_MODE === '1') {
  void Promise.all([import('./dev/demoBridge'), import('./stores/fileStore')]).then(([demo, files]) => {
    const initial = demo.demoInitialFiles()
    if (initial.length > 0) files.useFileStore().addFilePaths(initial)
  })
}
