import { createI18n } from 'vue-i18n'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh-CN.json'
import enUS from './locales/en-US.json'

// Type-define 'en-US' as the master schema for the resource
type MessageSchema = typeof zhTW
type Locale = 'zh-TW' | 'zh-CN' | 'en-US'

function getUserLocale(): Locale {
  const savedLocale = localStorage.getItem('locale')
  console.log('Saved Locale:', savedLocale)
  
  if (savedLocale && ['zh-TW', 'zh-CN', 'en-US'].includes(savedLocale)) {
    return savedLocale as Locale
  }

  const systemLocale = navigator.language
  console.log('System Locale:', systemLocale)
  
  const lowerLocale = systemLocale.toLowerCase()
  
  // Handle Traditional Chinese (Taiwan, Hong Kong, Macau)
  if (['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant'].includes(lowerLocale) || lowerLocale.startsWith('zh-hant')) {
    return 'zh-TW'
  }
  
  // Handle Simplified Chinese (China, Singapore, etc.)
  if (lowerLocale.startsWith('zh')) {
    return 'zh-CN'
  }

  // Default to English for all other languages
  return 'en-US'
}

const i18n = createI18n<[MessageSchema], Locale>({
  legacy: false, // Use Composition API
  locale: getUserLocale(),
  fallbackLocale: 'en-US',
  messages: {
    'zh-TW': zhTW,
    'zh-CN': zhCN,
    'en-US': enUS
  }
})

export default i18n
