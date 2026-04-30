## Why

目前專案以 Electron 作為桌面殼，功能完整但相對臃腫，發佈流程也只服務穩定版 Electron。若要在不影響既有 `main` 穩定線的前提下導入較輕量的 Tauri，必須先把桌面能力、分支策略與 beta 發佈流程明確拆開，避免新舊架構混雜。

## What Changes

- 將桌面執行環境從直接綁定 Electron IPC，重構為可由不同桌面 runtime 實作的 bridge 介面。
- 在 `beta` 分支建立 Tauri 應用殼，保持現有 Vue 介面與主要功能行為等價。
- 以 Tauri commands 與事件機制重建檔案選取、目錄選取、重新命名、複製、外部連結、縮放與關窗保護。
- 新增獨立的 beta 發佈通道，使用 `beta-v*` tag 建置並發佈 GitHub pre-release，不干擾既有 `main` / `v*` Electron release。
- 導入 beta 自動更新所需的 channel 與 metadata 隔離，讓 Tauri beta 只追蹤 beta 發佈。

## Non-Goals (optional)

## Capabilities

### New Capabilities

- `desktop-runtime-bridge`: 定義前端共用的桌面能力介面，讓桌面 API 不再直接耦合 Electron 全域物件。
- `tauri-desktop-shell`: 以 Tauri 提供與現有 Electron 版本等價的桌面檔案操作、視窗控制與更新能力。
- `beta-release-channel`: 建立與穩定版分離的 beta 分支、tag、CI/CD 與更新通道。

### Modified Capabilities

(none)

## Impact

- Affected specs: `desktop-runtime-bridge`, `tauri-desktop-shell`, `beta-release-channel`
- Affected code: `src/App.vue`, `src/components/*`, `src/stores/settingsStore.ts`, `src/services/updateService.ts`, `electron/*`, `package.json`, `.github/workflows/*`, `src-tauri/**`
- Affected systems: renderer-to-desktop API boundary, desktop packaging, release automation, update channel metadata
