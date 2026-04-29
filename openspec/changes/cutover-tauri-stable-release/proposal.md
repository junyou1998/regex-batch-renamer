## Why

Tauri beta 已經穩定到可以成為主要發佈線，但目前 repository 與 CI 仍把 Electron 視為 stable 預設，且 Tauri 的更新流程只對 beta 情境做了部分接線。若要正式發佈 0.5.0，就必須把 stable 預設切換到 Tauri，同時保留 beta 渠道與 app 啟動時的自動檢查更新能力。

## What Changes

- 將 `main` 的正式 release 流程由 Electron 改為 Tauri stable 多平台發佈。
- 將 Tauri 設定拆成 stable 預設與 beta 覆寫，讓 stable 與 beta 共用同一套程式碼但維持不同 channel、identifier、產品名稱與 updater endpoint。
- 將應用程式啟動時的更新檢查切換為 Tauri updater 優先，stable 與 beta 都可在啟動時自動檢查。
- 將預設開發與建置指令切換到 Tauri，並保留 beta prerelease workflow。
- 準備將 `beta` 分支併入 `main` 並以 `v0.5.0` 釋出正式版本。

## Capabilities

### New Capabilities

- `tauri-stable-release`: Stable release SHALL be produced by Tauri on `main` via `v*` tags while preserving the existing beta prerelease channel.
- `startup-update-check`: The desktop app SHALL automatically check for updates on launch and prefer in-app installation whenever the Tauri updater plugin supports the active channel.
- `release-channel-config`: The desktop build system SHALL derive stable and beta runtime identity, version, and updater endpoint from channel-aware build configuration.

### Modified Capabilities

(none)

## Impact

- Affected code:
  - Modified: .github/workflows/release.yml
  - Modified: .github/workflows/beta-release.yml
  - Modified: package.json
  - Modified: scripts/prepare-tauri-release-config.mjs
  - Modified: src/App.vue
  - Modified: src/components/AboutModal.vue
  - Modified: src/services/updateService.ts
  - Modified: src/services/desktop/tauri.ts
  - Modified: src/services/desktop/electron.ts
  - Modified: src-tauri/src/lib.rs
  - Modified: src-tauri/Cargo.toml
  - Modified: src-tauri/tauri.conf.json
  - Modified: src-tauri/tauri.release.conf.json
  - Modified: README.md
  - Modified: README.zh-TW.md
  - New: src-tauri/tauri.beta.conf.json
