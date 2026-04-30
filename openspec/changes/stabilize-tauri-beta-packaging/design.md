## Context

目前 Tauri 設定把 `bundle.targets` 設為 `all`，這在 macOS 本地環境會額外產生 `.dmg`。實測應用本體與 `.app` bundle 已可建出，但 `.dmg` 步驟失敗會讓整個 `tauri:build` 退出，造成開發與驗證流程不穩定。

Tauri updater 在 macOS 依賴的是 `.app` 衍生出的 updater archive，而不是 `.dmg`。因此需要把「本地 build 成功」與「release 產物完整」分成更精準的 bundle target，而不是用單一 `all`。

## Goals / Non-Goals

**Goals:**

- 讓本地 `pnpm run tauri:build` 在目前開發環境可穩定成功。
- 讓 beta release workflow 對不同平台選擇合適的 bundle 類型。
- 保留 updater artifact 的生成能力，不要求 `.dmg` 作為 beta updater 依賴。
- 建立可追蹤的任務與文件，避免未來再回到 `all` 的模糊策略。

**Non-Goals:**

- 不在本次變更中處理 Apple notarization 或商業簽章細節。
- 不重新設計整個 beta release 架構。

## Decisions

### Decision: Drive bundle selection from scripts instead of `bundle.targets = all`

移除 Tauri config 中固定的 `all` target，改由 Node 腳本根據平台或 CI 傳入的 bundle 清單產生 `tauri build --bundles ...`。

理由：
- 能讓本地與 CI 使用不同但明確的 bundle 目標。
- 避免 config 把所有平台都綁死在同一組 target。

替代方案：
- 保留 `all`，只在 CI 忽略失敗產物。否決，因為本地 build 還是會失敗。

### Decision: Use updater-compatible bundles only

macOS 使用 `app`，Windows 使用 `nsis`，Linux 使用 `appimage` 與 `deb`。release workflow 由 matrix 明確傳入對應 bundle。

理由：
- 符合 updater artifact 的來源型別。
- 減少無必要且不穩定的包裝步驟。

替代方案：
- macOS 繼續產 `.dmg`。否決，因為 updater 不需要 `.dmg`，且目前它是不穩定點。

## Risks / Trade-offs

- [不同平台 build 參數分散在 script 與 workflow] → 以單一 script 接受 `TAURI_BUNDLES` 環境變數集中邏輯。
- [未來若要恢復 `.dmg`] → 文件中明確說明目前 beta 不依賴 `.dmg`，之後可獨立新增。
