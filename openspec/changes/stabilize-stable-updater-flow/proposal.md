## Why

目前 stable 的 Tauri release 雖然能成功產出安裝檔，但 app 內更新鏈路仍未成立：release 缺 updater metadata / signature 產物，前端在 updater 無法工作時也缺少可靠 fallback，導致使用者無法驗證或使用正式版內更新。這需要在正式發版前補成完整閉環。

## What Changes

- 補齊 stable release workflow，讓它能產生並發佈 Tauri updater 所需的簽章產物與 stable metadata manifest。
- 收斂各平台 stable release asset 的命名規則，確保 GitHub Release 上傳檔名與 updater manifest 內的下載 URL 完全一致。
- 將 stable updater metadata 發佈到 repo 內可穩定存取的固定 endpoint，供正式版 app 啟動時自動檢查。
- 補強 app 端更新檢查邏輯，在 updater 無結果時仍可回退到 GitHub release 比較並提示使用者。
- 補上 macOS app 內更新安裝流程，讓正式版可從已安裝的 `.app` 下載、驗證、替換並重新開啟。
- 將更新日誌改為顯示歷史 stable release notes 清單，並可直接導向各版本的 GitHub release 頁面。
- 在 app 內更新成功並重新啟動後，自動彈出本次版本的 release notes。
- 補上正式版 updater 驗證流程與人工測試說明，讓 `v0.5.2 -> v0.5.3+` 可實測。

## Capabilities

### New Capabilities

- `stable-updater-delivery`: 定義 stable release 必須產生、發布與對外提供的 updater metadata 與簽章產物。

### Modified Capabilities

- `desktop-release-channels`: stable 渠道的正式 release 行為改為包含 app 內更新閉環與必要驗證保護。

## Impact

- Affected code:
  - Modified: .github/workflows/release.yml
  - Modified: src/App.vue
  - Modified: src/components/AboutModal.vue
  - Modified: src/services/updateService.ts
  - Modified: src/locales/en-US.json
  - Modified: src/locales/zh-TW.json
  - Modified: src/locales/zh-CN.json
  - Modified: src/locales/ja-JP.json
  - Modified: src/services/desktop/tauri.ts
  - Modified: src-tauri/src/lib.rs
  - Modified: src-tauri/Cargo.toml
  - Modified: src-tauri/Cargo.lock
  - Modified: README.md
  - Modified: README.zh-TW.md
  - New: scripts/generate-updater-manifest.mjs
  - New: updater/stable.json
  - New: openspec/changes/stabilize-stable-updater-flow/proposal.md
  - New: openspec/changes/stabilize-stable-updater-flow/design.md
  - New: openspec/changes/stabilize-stable-updater-flow/tasks.md
  - New: openspec/changes/stabilize-stable-updater-flow/specs/stable-updater-delivery/spec.md
  - New: openspec/changes/stabilize-stable-updater-flow/specs/desktop-release-channels/spec.md
