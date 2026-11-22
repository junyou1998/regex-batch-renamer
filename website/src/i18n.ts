import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zhTW from './locales/zh-TW.json'
import zhCN from './locales/zh-CN.json'

export type SiteLocale = 'en' | 'zh-TW' | 'zh-CN'
export const LOCALES: { code: SiteLocale; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'zh-TW', label: '繁體中文' },
    { code: 'zh-CN', label: '简体中文' },
]

const STORAGE_KEY = 'renamix-site-locale'

function detect(): SiteLocale {
    const fromUrl = new URLSearchParams(location.search).get('lang')
    const saved = fromUrl || localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh-TW' || saved === 'zh-CN') return saved
    const nav = navigator.language.toLowerCase()
    if (nav.startsWith('zh')) {
        return /tw|hk|mo|hant/.test(nav) ? 'zh-TW' : 'zh-CN'
    }
    return 'en'
}

const i18n = createI18n<[typeof en], SiteLocale, false>({
    legacy: false,
    locale: detect(),
    fallbackLocale: 'en',
    messages: { en, 'zh-TW': zhTW, 'zh-CN': zhCN },
})

export function setLocale(locale: SiteLocale) {
    i18n.global.locale.value = locale
    document.documentElement.lang = locale
    try {
        localStorage.setItem(STORAGE_KEY, locale)
    } catch {
        /* private mode */
    }
}

document.documentElement.lang = i18n.global.locale.value

/** Screenshot folder for the current language (en uses en-US captures). */
export function screenshotLang(locale: string) {
    return locale === 'en' ? 'en-US' : locale
}

export default i18n
