## Context

目前 `beta` 分支已經切換到 Tauri，並透過 `beta-v*` tag 觸發 GitHub Actions 建置多平台 beta 發佈。但流程仍直接建立 prerelease，而不是 draft；About 視窗也仍以 GitHub Releases 作為主要更新入口。另一方面，Tauri runtime 的真實版本來自 `src-tauri/tauri.conf.json`，但前端顯示與比較版本時仍使用 `package.json`，這會讓 beta 更新與版號顯示失真。Repo 中的 Electron 穩定線也仍保留完整的 `electron/` shell 與 `release.yml`，需要有一個分階段退場計畫，而不是在 beta 穩定前直接刪除。

## Goals / Non-Goals

**Goals:**

- 讓 beta tag 建立 draft pre-release，由人工審核後才正式發佈。
- 讓 Tauri beta app 於 app 內完成更新檢查與安裝入口。
- 讓前端顯示與比較的版本來自實際桌面 runtime。
- 記錄 Electron 刪除前的門檻與分階段清理順序。

**Non-Goals:**

- 本輪不直接刪除 `electron/` 目錄或 `main` 分支的穩定 Electron 發佈流程。
- 本輪不建立新的外部更新伺服器；若現有 `BETA_UPDATER_ENDPOINT` 已存在，沿用其協議。
- 本輪不改動 main 線正式穩定版的 release/tag 規則。

## Decisions

### Publish draft beta releases from GitHub Actions

`softprops/action-gh-release` 將同時設為 `prerelease: true` 與 `draft: true`。beta tag 仍然會觸發完整建置，但 release 在人工審核前不會被正式公開。這保留既有多平台 build 流程，又能避免把未驗收產物直接推到使用者面前。

### Use runtime-reported version for app update UI

Tauri 與 Electron bridge 都回傳 `DesktopRuntimeInfo.version`。About 視窗與更新比較一律使用 runtime 版本，而不是直接讀 `package.json`。這能讓 beta app 的 `0.4.2-beta.1` 與穩定 Electron 的 `0.4.2` 各自正確顯示。

### Prefer updater plugin for Tauri installs, keep GitHub release fetch for changelog

Tauri beta app 的更新檢查與安裝改走 `@tauri-apps/plugin-updater`，因為它已經能依平台處理 updater bundle 與安裝。GitHub Releases API 仍保留給 changelog 顯示，避免把 changelog 下載與安裝流程綁死在同一個來源上。

### Document Electron retirement before deletion

Electron 刪除改成文件驅動：先定義 beta 升級、安裝、回報與 CI 穩定門檻，再定義刪除順序，最後才實際移除 `electron/`、Electron scripts、Electron workflow 與相依套件。這比直接刪碼更安全，因為目前 stable 線仍依賴 Electron。

## Risks / Trade-offs

- [Draft release 無法被一般使用者直接看見] → 這是刻意設計，用人工審核換取更低的誤發佈風險。
- [Updater 端點若未提供合法 metadata，app 內更新仍無法成功] → UI 僅在 updater plugin 有可用更新時顯示安裝流程，並在文件中明確標示 endpoint 是前提條件。
- [Runtime 版本來源從 `package.json` 改為 bridge 後，Electron 與 Tauri 需要同步維護] → 由 bridge 層統一回傳，避免前端各處自行判斷。
- [提前刪 Electron 可能破壞穩定線] → 本輪只交付退場計畫，不做破壞性刪除。

## Migration Plan

1. 將 beta release workflow 改為 draft prerelease，並以新的 beta tag 重新發佈。
2. 讓桌面 bridge 回傳實際 runtime 版本，About 視窗改用該版本檢查與顯示更新。
3. 在 Tauri beta app 啟用 app 內更新 CTA 與安裝流程，保留 changelog 檢視。
4. 新增 Electron 退場文件，作為後續刪碼 change 的輸入。

## Open Questions

- `BETA_UPDATER_ENDPOINT` 的 metadata 來源是否已經穩定提供 `latest.json` 或等效格式；若沒有，下一輪需補一個靜態 metadata 發佈機制。
