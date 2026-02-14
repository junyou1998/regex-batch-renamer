import { createI18n } from 'vue-i18n'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import jaJP from './locales/ja-JP.json'
import { getInitialLocale, type Locale } from './services/preferences'

type MessageSchema = typeof zhTW

const i18n = createI18n<[MessageSchema], Locale>({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-TW': zhTW,
    'zh-CN': zhCN,
    'en-US': enUS,
    'ja-JP': jaJP
  }
})

export default i18n
