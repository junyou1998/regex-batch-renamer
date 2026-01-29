# Regex Batch Renamer

**繁體中文** | [简体中文](README.zh-CN.md) | [English](README.md)

🌐 **官方網站**: https://renamer.junyou.tw/

<img src="public/icon.png" align="left" width="128" style="margin-right: 24px; margin-bottom: 12px;" alt="App Icon" />

一個強大且直觀的跨平台批次更名工具 (支援 Windows / macOS / Linux)。支援正規表達式 (Regex)、純文字取代以及流水號功能，讓繁瑣的檔案更名工作變得輕鬆簡單。

<br clear="left"/>

<img src="public/screenshot.png" alt="App Screenshot" width="800" />

## ✨ 主要功能

- **直觀操作**：支援拖曳檔案 (Drag & Drop) 與即時預覽更名結果。
- **雙重模式**：
    - **Regex 模式**：支援完整的正規表達式語法，適合進階使用者。
    - **純文字模式**：自動處理跳脫字元，直觀取代 `[]`、`()` 等特殊符號。
- **流水號功能**：使用 `${n}` 語法輕鬆插入遞增數字，並支援補零 (如 `${n:03}`)。
- **現代化介面**：採用質感設計，並完整支援 macOS 淺色/深色模式 (可跟隨系統)。
- **安全可靠**：執行前可完整預覽，並支援「複製到...」功能以保留原始檔案。

## 📥 安裝說明

### macOS 使用者注意事項

由於本軟體未經 Apple 開發者簽章（因為我是一般獨立開發者），在 macOS 上安裝後首次開啟可能會出現 **「應用程式已損毀，無法打開」** 的錯誤訊息。這是 macOS 的安全機制所致，並非軟體真的損壞。

請開啟終端機 (Terminal)，並執行以下指令來修復：

```bash
sudo xattr -r -d com.apple.quarantine /Applications/Regex\ Batch\ Renamer.app
```

執行後輸入密碼即可正常開啟。

### Windows / Linux

直接下載對應的安裝檔執行即可。

## 🚀 快速開始

1. **加入檔案**：將想要更名的檔案拖曳至左上角的區域，或點擊按鈕選擇檔案。
2. **新增規則**：在左側「操作流程」中點擊「+ 新增規則」。
3. **設定條件**：
    - 輸入「尋找目標」與「取代為」的內容。
    - 勾選/取消勾選「使用正規表達式 (Regex)」來切換模式。
4. **預覽結果**：右側列表會即時顯示更名後的預覽，變更部分會以高亮顯示。
5. **執行更名**：確認無誤後，點擊「執行重命名」直接修改，或「複製到...」將更名後的檔案複製到新位置。

## 📖 進階教學

### 流水號 (${n})

在「取代為」欄位中使用 `${n}` 來插入序號：

- `${n}`：1, 2, 3...
- `${n:03}`：001, 002, 003...

### 常用 Regex 範例

- **刪除空白**：尋找 `\s+`，取代為 `(留空)`
- **統一日期**：尋找 `(\d{4})(\d{2})(\d{2})`，取代為 `$1-$2-$3` (將 20231125 轉為 2023-11-25)

_更多教學請點擊軟體介面中的「？」按鈕查看。_

## 🛠️ 使用技術

本專案使用以下現代化網頁技術構建：

- **核心框架**：[Electron](https://www.electronjs.org/)
- **前端框架**：[Vue 3](https://vuejs.org/) (Composition API)
- **語言**：[TypeScript](https://www.typescriptlang.org/)
- **樣式**：[Tailwind CSS](https://tailwindcss.com/)
- **建置工具**：[Vite](https://vitejs.dev/)
- **狀態管理**：[Pinia](https://pinia.vuejs.org/)

## ☕ 贊助開發

如果您覺得這個工具對您有幫助，歡迎贊助我一杯咖啡，這將成為我持續開發與維護的動力！

<a href="https://www.buymeacoffee.com/junyou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## 📄 授權

MIT License
