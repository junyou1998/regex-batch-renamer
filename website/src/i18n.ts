import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh-CN.json'

type MessageSchema = typeof en

const i18n = createI18n<[MessageSchema], 'en' | 'zh-TW' | 'zh-CN'>({
    legacy: false,
    locale: navigator.language.includes('zh-TW') ? 'zh-TW' :
        navigator.language.includes('zh-CN') || navigator.language.includes('zh') ? 'zh-CN' : 'en',
    fallbackLocale: 'en',
    messages: {
        'en': en,
        'zh-TW': zhTW,
        'zh-CN': zhCN
    }
})

export default i18n
