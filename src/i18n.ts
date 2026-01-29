import { createI18n } from 'vue-i18n'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'
import jaJP from './locales/ja-JP.json'


type MessageSchema = typeof zhTW
type Locale = 'zh-TW' | 'zh-CN' | 'en-US' | 'ja-JP'

function getUserLocale(): Locale {
  const savedLocale = localStorage.getItem('locale')
  console.log('Saved Locale:', savedLocale)

  if (savedLocale && ['zh-TW', 'zh-CN', 'en-US', 'ja-JP'].includes(savedLocale)) {
    return savedLocale as Locale
  }

  const systemLocale = navigator.language
  console.log('System Locale:', systemLocale)

  const lowerLocale = systemLocale.toLowerCase()


  if (['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant'].includes(lowerLocale) || lowerLocale.startsWith('zh-hant')) {
    return 'zh-TW'
  }


  if (lowerLocale.startsWith('zh')) {
    return 'zh-CN'
  }


  if (lowerLocale.startsWith('ja')) {
    return 'ja-JP'
  }


  return 'en-US'
}

const i18n = createI18n<[MessageSchema], Locale>({
  legacy: false,
  locale: getUserLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-TW': zhTW,
    'zh-CN': zhCN,
    'en-US': enUS,
    'ja-JP': jaJP
  }
})

export default i18n
