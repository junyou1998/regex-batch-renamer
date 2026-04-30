## Context

目前 stable Tauri release 已能建置三平台安裝檔，但 updater 相關產物與 metadata endpoint 尚未形成固定交付物。正式版 app 啟動時會優先使用 Tauri updater，但若 release 沒有對應的簽章產物或 endpoint metadata，使用者只會看到沒有更新提示或只能退回 GitHub compare 連結。

## Goals / Non-Goals

**Goals:**

- 讓 stable release workflow 對 updater 必要設定採取 fail-fast 驗證。
- 讓每次 stable release 自動生成固定格式的 updater manifest，並發布到穩定 endpoint。
- 讓 app 端在 updater 無回應時仍能回退到 GitHub release 比較提示使用者。
- 提供可操作的人工驗證流程，驗證 `v0.5.1 -> v0.5.2` 更新閉環。

**Non-Goals:**

- 不在這次變更中提供使用者切換 stable/beta 渠道的 UI。
- 不在這次變更中導入額外 hosting 服務；先使用既有 GitHub repo 作為 stable metadata 發佈位置。

## Decisions

### Release workflow SHALL generate stable updater manifest from collected platform assets

release workflow 在各平台 job 收集安裝檔與簽章產物後，於 publish job 根據已下載的 release-assets 生成一份 `stable.json`。這份 manifest 使用固定平台鍵值與 GitHub Release download URL，避免手動維護 metadata。

### Stable updater endpoint SHALL be repository-backed and immutable by tag contents

stable updater endpoint 先採用 repo 內 `updater/stable.json`，由 release workflow 在發版完成時更新到 `main`。這讓 app 有穩定 URL 可查，且 metadata 內容與當次 tag 綁定，不需要額外服務。

### App update check SHALL fall back to GitHub release comparison when updater is unavailable

Tauri updater 是正式更新主路徑，但使用者仍需要在 metadata 暫時異常時看見新版提示。因此 app 端在 updater 沒有回傳可用更新時，不直接結束流程，而是再做 GitHub latest release 比較。

## Risks / Trade-offs

- [Workflow pushes back to main during release] → 只更新 `updater/stable.json` 單一檔案，commit 訊息帶 tag，保持可追蹤。
- [Updater artifact naming differs across platforms] → manifest script 使用明確檔名模式與失敗即退出，避免 silently publishing broken metadata。
- [GitHub raw content cache delay] → 使用者端仍保留 GitHub release fallback，避免 metadata 剛更新時完全無提示。
