# Regex Batch Renamer

**繁體中文** | [简体中文](README.zh-CN.md) | [English](README.md)

🌐 **官方網站**: https://renamer.junyou.tw/

<img src="public/icon.png" align="left" width="128" style="margin-right: 24px; margin-bottom: 12px;" alt="App Icon" />

一個強大、極致輕量且直觀的跨平台批次更名工具 (支援 macOS / Windows / Linux)。基於 **Tauri v2 + Vue 3 + Tailwind CSS v4 + Rust** 打造，支援正規表達式 (Regex)、純文字取代、自訂快速範本與流水號功能，讓繁瑣的檔案更名工作變得流暢且簡單。

<br clear="left"/>
<br />

<img src="public/screenshot.png" alt="App Screenshot" width="800" />

## ✨ 主要功能

- **🤖 AI 智慧規則助理**：
    - **自然語言生成規則**：用大白話描述更名意圖（例如「將日期前移、刪除括號前綴、轉底線小寫」），由 AI 自動分析檔案特徵並生成精確的 Regex 規則管道。
    - **本機 CLI 模式**：支援 **Claude Code CLI**、**OpenAI Codex CLI** 與 **xAI Grok CLI**，直接使用本機已登入的 CLI 工具進行生成。
    - **主流 API 與本地 Ollama**：支援 **Google Gemini**、**OpenAI**、**Anthropic** 雲端 API，以及 **Ollama 本機離線模型**（免金鑰、自動匹配本機模型標籤）。
    - **雙層配置管理與安全中斷**：支援自訂多組 AI 配置與一鍵切換預設，生成中途隨時可即時「停止生成」並釋放連線／殺死進程。
- **直觀操作**：支援拖曳檔案 (Drag & Drop) 與即時高亮預覽更名結果。
- **雙重更名模式**：
    - **Regex 模式**：支援完整強大的正規表達式語法，適合進階批次處理。
    - **純文字模式**：自動處理跳脫字元，直觀取代 `[]`、`()`、空白等特殊符號。
- **靈活流水號**：使用 `$n` 或 `${n}` 語法輕鬆插入遞增數字，支援自訂起始值與位數補零（如 `${n:2}` 或 `001`）。
- **快速與自訂範本**：內建常用範本（如移除空格、轉底線、全域序號替換），並支援將常用更名流程儲存為自訂範本隨時調用。
- **安全保護機制**：
    - 執行前完整預覽衝突檢測。
    - 支援「建立副本」保留原始檔案。
    - **視窗關閉保護**：有未套用的更名時主動彈出確認，防止誤關遺失進度。
- **質感現代化介面**：沉浸式原生 Titlebar 設計，支援側邊欄折疊收合與 macOS / Windows / Linux 深淺色主題（自動跟隨系統）。

## 📥 下載與安裝

請至 [GitHub Releases](https://github.com/junyou1998/regex-batch-renamer/releases) 下載最新安裝檔：

- **macOS**：提供 Apple Silicon (`.dmg`) 與 Intel 安裝檔。
- **Windows**：提供 64 位元安裝檔 (`.exe`)。
- **Linux**：提供 AppImage 與 `.deb` 套件。

### macOS 使用者注意事項

若安裝未簽章的 macOS 版本觸發 Gatekeeper 提示，可於終端機執行指令手動解除隔離：

```bash
xattr -r -d com.apple.quarantine "/Applications/Regex Batch Renamer.app"
```

## 🚀 快速開始

1. **加入檔案**：將檔案拖曳至視窗任意區域，或點擊「加入檔案 / 加入資料夾」。
2. **新增規則**：在左側「更名流程」中點擊「+ 新增規則」或選擇「⚡ 快速範本」。
3. **設定條件**：
    - 輸入「尋找目標」與「取代為」內容。
    - 勾選/取消勾選「使用正規表達式 (Regex)」切換模式。
4. **預覽結果**：右側表格即時預覽新檔名，變更部分以綠色高亮標記。
5. **執行更名**：確認無誤後，點擊「執行重命名」直接修改檔名，或「建立副本」另存檔案。

## 📖 常用技巧

### 流水號 ($n)

在「取代為」欄位中使用序號變數：
- `${n}`：1, 2, 3...
- `${n:2}` 或 `${n:03}`：01, 02, 03... / 001, 002, 003...

### 常用 Regex 範例

- **刪除空白**：尋找 `\s+`，取代為 `(留空)`
- **日期格式標準化**：尋找 `(\d{4})(\d{2})(\d{2})`，取代為 `$1-$2-$3` (將 20231125 轉為 2023-11-25)
- **刪除括號與內容**：尋找 `\s*\([^)]*\)`，取代為 `(留空)`

## 🤖 AI 智慧規則助理使用指南

1. **開啟助理**：點擊右上角「✨ AI 助理」按鈕展開對話側欄。
2. **選擇或新增服務**：
   - 預設提供 **Claude Code CLI**、**OpenAI Codex CLI** 與 **xAI Grok CLI** 本機模式（需本機已安裝並登入）。
   - 或點擊「設定 > AI 助理」新增 **Google Gemini**、**OpenAI**、**Anthropic** 或 **本機 Ollama** API 配置。
3. **自然語言提問**：
   - 「幫我把檔案名中的日期 20240101 改成 2024-01-01」
   - 「移除動漫壓制組的 [XXX] 前綴並補上 S01E 流水號」
   - 「提取所有底線前的文字，其餘轉為大寫」
4. **即時套用**：AI 會在對話中回傳分析結果與更名規則管道，並支援「自動套用」或手動一鍵載入至左側更名流程！

## 🛠️ 開發與技術棧

本專案全面採用現代化技術架構打造：

- **桌面應用框架**：[Tauri v2](https://v2.tauri.app/) (高效、極致輕量的 Rust 後端)
- **前端框架**：[Vue 3](https://vuejs.org/) (Composition API + `<script setup>`)
- **樣式引擎**：[Tailwind CSS v4](https://tailwindcss.com/)
- **程式語言**：[TypeScript](https://www.typescriptlang.org/) + [Rust](https://www.rust-lang.org/)
- **建置工具**：[Vite](https://vitejs.dev/)
- **狀態管理**：[Pinia](https://pinia.vuejs.org/)
- **國際化支援**：[Vue I18n](https://vue-i18n.intlify.dev/)

### 本地開發指令

```bash
# 安裝依賴 (優先使用 pnpm)
pnpm install

# 啟動桌面應用開發模式 (含 Vite 熱重載與 Rust 後端)
pnpm run dev

# 執行型別檢查與前端建置驗證
pnpm run tauri:ci

# 打包正式發行版桌面應用
pnpm run build
```

## ☕ 贊助開發

如果您覺得這個工具對您有幫助，歡迎贊助我一杯咖啡，這將成為我持續開發與維護的動力！

<a href="https://www.buymeacoffee.com/junyou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## 📄 授權

[MIT License](LICENSE)
