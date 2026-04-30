## Why

目前 Tauri beta 遷移已經能通過型別檢查與 Rust 編譯，但本地 `tauri:build` 在 macOS 仍因 `.dmg` 打包失敗而中斷，代表目前的 bundle target 與 release 產物策略還不夠穩定。這會直接影響開發者本地驗證與 beta 發佈流程的可靠性，因此需要補一個針對打包穩定性的收尾變更。

## What Changes

- 將 Tauri build / release 的 bundle target 從固定 `all` 改為依平台與用途決定。
- 讓本地開發與 CI release 都只產生 updater 與發佈真正需要的 bundle 類型。
- 修正 beta release workflow，使其對應各平台的可用 bundle 類型與 updater artifact。
- 補上對這套打包策略的文件與追蹤任務。

## Non-Goals (optional)

## Capabilities

### New Capabilities

- `tauri-package-stability`: 確保 Tauri beta 的本地建置與 CI 發佈使用穩定且與 updater 相容的 bundle 策略。

### Modified Capabilities

(none)

## Impact

- Affected specs: `tauri-package-stability`
- Affected code: `package.json`, `scripts/*`, `src-tauri/tauri.conf.json`, `.github/workflows/beta-release.yml`, `.github/workflows/beta-validation.yml`, `README*`
- Affected systems: local packaging, GitHub Actions beta release, updater artifact generation
