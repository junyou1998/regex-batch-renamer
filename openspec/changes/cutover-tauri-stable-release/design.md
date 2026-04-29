## Context

目前 `beta` 分支已經具備 Tauri 多平台打包、draft beta prerelease、app 內更新入口與基礎 updater 接線，但 stable 線的預設腳本、`main` release workflow、Tauri app identity 與啟動時的更新檢查還沒有完成正式切換。現況若直接把 `beta` merge 到 `main`，stable release 仍可能沿用 Electron workflow 或 Beta 身分資訊，這會造成正式版與 beta 渠道互相污染。

## Goals / Non-Goals

**Goals:**

- 讓 `main` 上的 `v*` tag 發佈 Tauri stable 0.5.0 多平台正式版。
- 保留 `beta-v*` tag 的 beta prerelease 流程。
- 讓 stable 與 beta 共用一份程式碼，但在 build 時有不同 channel、產品名稱、identifier 與 updater endpoint。
- 讓 app 在啟動時自動檢查更新，且 Tauri runtime 以 in-app updater 為主。
- 將 `beta` 併入 `main` 並推送 `v0.5.0`。

**Non-Goals:**

- 本輪不實作使用者自行切換 stable/beta channel 的設定 UI。
- 本輪不全面刪除 Electron 原始碼與依賴，只切換 stable 預設與 release 流程。
- 本輪不引入新的第三方更新服務；沿用既有 updater metadata endpoint 機制。

## Decisions

### Use stable Tauri config as the default and apply beta overrides at build time

`src-tauri/tauri.conf.json` 改為 stable 預設配置，包含 stable product name、identifier 與 version。新增 `src-tauri/tauri.beta.conf.json` 只覆寫 beta 專屬欄位。`prepare-tauri-release-config.mjs` 依 channel 決定是否合併 beta override，避免把 main 永久綁成 Beta 身分。

### Derive version and channel from build environment

Rust runtime 與產物 metadata 需要知道當前是 stable 還是 beta。build scripts 會優先讀取 `APP_RELEASE_CHANNEL`、`APP_VERSION` 與 `TAURI_UPDATER_ENDPOINT`；若是在 tag workflow 中且未顯式指定版本，則從 `GITHUB_REF_NAME` 推導 `v0.5.0` 或 `beta-v0.5.1-beta.0`。這樣 stable 與 beta 都不需要手工改版本檔才能發佈。

### Make startup update checks channel-agnostic for Tauri

App 啟動時的更新檢查不再只針對 beta。只要 runtime 是 Tauri 且 updater plugin 可用，就優先使用 plugin 檢查與安裝；若 runtime 不是 Tauri，才回退到 GitHub release 連結模式。這讓 stable Tauri 正式版在啟動時也能立即檢查更新。

### Replace Electron stable release workflow with Tauri matrix publish

`release.yml` 會改成與 beta 相同的 Tauri 多平台矩陣，但 stable 走公開 release，不是 draft / prerelease。beta workflow 保留 draft prerelease 行為。兩條 workflow 使用相同的 bundle 蒐集模式，避免 stable 重新踩到 beta 已經解過的 packaging 問題。

## Risks / Trade-offs

- [Stable updater endpoint 未就緒] → workflow 與 app 會接好 stable updater，但若 endpoint metadata 不正確，安裝仍無法成功；需要用 `v0.5.0` 實際驗證。
- [預設腳本切到 Tauri 後，仍在維護 Electron 的習慣會被打斷] → 保留 `electron:*` 或 `legacy:*` 指令，讓過渡期仍可手動使用。
- [Beta 與 stable 共用程式碼可能造成 channel 設定混淆] → 將 channel identity 集中在 build script 合併邏輯，不散落在 UI 或 Rust 常數中。
- [直接合併到 main 後若 stable workflow 有缺口，回滾範圍會較大] → 先在 `beta` 實作並做本地驗證，再 fast-forward merge 到 `main`。

## Migration Plan

1. 將 stable/beta channel-aware Tauri config 與 updater env 收斂到 script 層。
2. 切換 app 啟動時更新檢查為所有 Tauri channel 共用。
3. 將 `release.yml` 改成 Tauri stable 發佈，保留 beta workflow。
4. 將預設 scripts/README 切到 Tauri stable。
5. 驗證後 fast-forward `beta` 到 `main`，推送 `main` 與 `v0.5.0` tag。

## Open Questions

- `STABLE_UPDATER_ENDPOINT` 是否已在 repo secrets 中配置；若沒有，release 可以完成，但 stable app 內更新要等 endpoint 配置後才能完整閉環。
