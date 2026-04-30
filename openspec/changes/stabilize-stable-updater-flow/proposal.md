## Why

目前 stable 的 Tauri release 雖然能成功產出安裝檔，但 app 內更新鏈路仍未成立：release 缺 updater metadata / signature 產物，前端在 updater 無法工作時也缺少可靠 fallback，導致使用者無法驗證或使用正式版內更新。這需要在正式發版前補成完整閉環。

## What Changes

- 補齊 stable release workflow，讓它能產生並發佈 Tauri updater 所需的簽章產物與 stable metadata manifest。
- 將 stable updater metadata 發佈到 repo 內可穩定存取的固定 endpoint，供正式版 app 啟動時自動檢查。
- 補強 app 端更新檢查邏輯，在 updater 無結果時仍可回退到 GitHub release 比較並提示使用者。
- 補上正式版 updater 驗證流程與人工測試說明，讓 `v0.5.1 -> v0.5.2` 可實測。

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
  - Modified: README.md
  - Modified: README.zh-TW.md
  - New: scripts/generate-updater-manifest.mjs
  - New: updater/stable.json
  - New: openspec/changes/stabilize-stable-updater-flow/proposal.md
  - New: openspec/changes/stabilize-stable-updater-flow/design.md
  - New: openspec/changes/stabilize-stable-updater-flow/tasks.md
  - New: openspec/changes/stabilize-stable-updater-flow/specs/stable-updater-delivery/spec.md
  - New: openspec/changes/stabilize-stable-updater-flow/specs/desktop-release-channels/spec.md
