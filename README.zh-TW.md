# Regex Batch Renamer

**繁體中文** | [简体中文](README.zh-CN.md) | [English](README.md)

🌐 **官方網站**: https://renamer.junyou.tw/

<img src="public/icon.png" align="left" width="128" style="margin-right: 24px; margin-bottom: 12px;" alt="App Icon" />

一個強大且直觀的跨平台批次更名工具 (支援 Windows / macOS / Linux)。支援正規表達式 (Regex)、純文字取代以及流水號功能，讓繁瑣的檔案更名工作變得輕鬆簡單。

<br clear="left"/>
<br />

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

未簽章的 macOS build 仍有可能因下載與解壓流程不同而觸發 Gatekeeper 警告。若系統因 quarantine metadata 阻擋應用程式，可手動清除：

```bash
xattr -r -d com.apple.quarantine /Applications/Regex\ Batch\ Renamer.app
```

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

- **桌面 Runtime**：[Tauri](https://tauri.app/) 作為目前穩定桌面應用，先前的 [Electron](https://www.electronjs.org/) 線暫時保留於退場過渡期
- **前端框架**：[Vue 3](https://vuejs.org/) (Composition API)
- **語言**：[TypeScript](https://www.typescriptlang.org/)
- **樣式**：[Tailwind CSS](https://tailwindcss.com/)
- **建置工具**：[Vite](https://vitejs.dev/)
- **狀態管理**：[Pinia](https://pinia.vuejs.org/)

## 🧪 發佈渠道

穩定版現在已切換為 `main` 分支上的 Tauri 發佈線。

Beta 渠道仍然保留，並使用獨立流程：

- `main` + `v*` tag：Tauri 穩定版 release
- `beta` 分支 push：只跑 Tauri beta 驗證 CI
- `beta-v*` tag：建立供人工審核的 Tauri GitHub draft pre-release

常用指令：

```bash
pnpm run tauri:dev
pnpm run tauri:build
pnpm run electron:dev
pnpm run electron:build
```

若有提供 `TAURI_UPDATER_PUBKEY` 與對應 channel 的 updater endpoint，`pnpm run tauri:build:release` 會產生包含 updater 設定的 release config；若沒有提供，建置仍可完成，但不會啟用 app 內更新。

Stable release 會直接正式發佈。Beta release 仍會先建立成 draft prerelease，讓維護者人工檢查資產後再正式發佈。只要 active channel 的 updater endpoint 提供合法 metadata，Tauri app 就會在啟動時自動檢查更新並優先使用 app 內安裝。

### Stable App 內更新驗證流程

要真正驗證 stable app 內更新，請使用兩個連續的 stable 版本：

1. 先安裝較舊的 stable 版本，例如 `v0.5.0`。
2. 發佈下一個 stable tag，例如 `v0.5.1`。
3. 確認新的 release assets 內有 updater 產物，例如 `.sig`、`.app.tar.gz`、`.AppImage.sig` 或 Windows updater 簽章檔。
4. 在 macOS 上，請先把已安裝 app 放到 `/Applications` 再測試 app 內安裝。
5. 打開舊版 app，等待啟動時自動檢查更新。
6. 確認更新提示或 About 視窗能看到新版號。
7. 執行 app 內安裝流程，重開後確認 runtime version 已切換到新版。

Stable updater endpoint 預期使用 repo 內固定 manifest：

```text
https://raw.githubusercontent.com/junyou1998/regex-batch-renamer/main/updater/stable.json
```

Electron 退場的門檻與刪除順序已記錄在 [docs/electron-retirement-plan.md](docs/electron-retirement-plan.md)。

## ☕ 贊助開發

如果您覺得這個工具對您有幫助，歡迎贊助我一杯咖啡，這將成為我持續開發與維護的動力！

<a href="https://www.buymeacoffee.com/junyou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## 📄 授權

MIT License
