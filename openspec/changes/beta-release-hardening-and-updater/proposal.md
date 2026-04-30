## Why

目前 Tauri beta 發佈流程已能建置，但仍有三個缺口：beta release 會直接公開而非 draft、macOS/Windows/Linux 的 updater 與版本顯示尚未完全對齊，以及 repo 內仍保留完整 Electron 穩定線卻缺少正式的退場計畫。這些問題會直接影響 beta 驗收、人工審核流程與後續正式切換。

## What Changes

- 將 Tauri beta GitHub Actions 發佈流程改為建立 draft pre-release，並允許清理與重發 beta tag。
- 補齊 Tauri app 內更新流程，讓 beta app 能在介面內檢查與安裝更新，而不是只導向 GitHub Releases。
- 收斂桌面 runtime 版本來源，避免前端顯示版本與 Tauri 實際版本不一致。
- 新增 Electron 逐步退場文件，定義何時可刪除 `electron/` 與 Electron build/release 路徑。

## Capabilities

### New Capabilities

- `draft-beta-release`: Beta 版 SHALL 透過 GitHub Actions 建立 draft pre-release，並只附上可分發的安裝產物與 updater 產物。
- `in-app-updater`: Tauri beta app SHALL 在 app 內檢查更新、顯示新版本並觸發安裝流程。
- `electron-retirement-plan`: Repo SHALL 記錄 Electron 穩定線退場的前置條件、分階段刪除順序與回退策略。

### Modified Capabilities

(none)

## Impact

- Affected code:
  - Modified: .github/workflows/beta-release.yml
  - Modified: src/components/AboutModal.vue
  - Modified: src/services/desktop/types.ts
  - Modified: src/services/desktop/electron.ts
  - Modified: src/services/desktop/tauri.ts
  - Modified: src-tauri/src/lib.rs
  - Modified: src-tauri/tauri.conf.json
  - Modified: src/locales/en-US.json
  - Modified: src/locales/zh-TW.json
  - Modified: README.md
  - Modified: README.zh-TW.md
  - New: docs/electron-retirement-plan.md
