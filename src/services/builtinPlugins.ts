import type { InstalledPlugin } from '../stores/pluginStore'

/**
 * 內建預載外掛清單
 * 抽離後的外掛由官方外掛市集（regex-batch-renamer-plugins）統一維護與發布。
 */
export const BUILTIN_PLUGINS: Record<string, InstalledPlugin> = {}


