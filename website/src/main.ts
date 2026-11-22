import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import i18n from './i18n'

import { vReveal, vTilt } from './directives/motion'

createApp(App).use(i18n).directive('reveal', vReveal).directive('tilt', vTilt).mount('#app')
