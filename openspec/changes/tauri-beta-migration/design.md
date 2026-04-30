## Context

目前桌面能力直接透過 `window.ipcRenderer` 散落在 Vue 元件與 store 中，Electron `main.ts` 同時承擔檔案操作、視窗生命週期與外部連結責任。專案只存在一條由 `v*` tag 觸發的 Electron release workflow，沒有 beta 通道，也沒有可讓 Tauri 與 Electron 並存的桌面 API 邊界。

這次變更需要同時處理三個交叉面向：前端與桌面 runtime 的抽象化、Tauri 應用殼的等價行為重建，以及與現有 stable 線完全分離的 beta 發佈流程。因為這三者會跨越 `src/`、桌面端啟動程式與 GitHub Actions，所以需要先固定技術決策再實作。

## Goals / Non-Goals

**Goals:**

- 保留現有 Vue 3 / Pinia / Tailwind UI 與主要使用流程，不做產品層面的功能刪減。
- 將 renderer 對桌面能力的依賴收斂到單一 bridge 介面，讓 Tauri 與 Electron 可以各自實作。
- 在 `beta` 分支引入 Tauri 應用，重建檔案選取、重新命名、複製、視窗縮放、外部連結、關窗保護與 beta 更新能力。
- 為 Tauri 建立獨立於 Electron stable 的 CI/CD、release 命名與 updater channel。
- 缺少商業簽章憑證時，beta 流程仍可產出可測試的構建結果。

**Non-Goals:**

- 不在本次變更中重設整體 UI/UX 視覺設計。
- 不在 `main` 分支上混入 Tauri 與 Electron 雙 runtime 的正式共存發佈邏輯。
- 不在本次變更中處理 stable Tauri 正式上線或取代 Electron stable。
- 不強制要求所有平台在 beta 階段都具備完整簽章與 notarization。

## Decisions

### Decision: Introduce a renderer desktop runtime bridge

前端新增單一 `desktop` 服務介面，統一定義檔案選取、目錄選取、rename/copy、外部連結、縮放、平台資訊、關窗保護與更新操作。`src/` 內不再直接引用 `window.ipcRenderer` 或 Tauri 全域 API。

理由：
- 讓 renderer 行為與桌面 runtime 解耦，避免 Tauri 遷移時大面積滲入平台判斷。
- 讓 Electron stable 與 Tauri beta 之後都能維持相同的資料結構與錯誤碼。

替代方案：
- 直接在元件中把 Electron API 改成 Tauri API。否決，因為會把 runtime 細節再次散落，之後回頭維護 stable/beta 會更難。

### Decision: Implement Tauri commands for all existing desktop behaviors

Tauri 端建立 Rust commands 與必要事件流程，逐一對應現有 Electron handlers：選檔、選目錄、rename、copy、開外部連結、縮放、未保存變更的關窗攔截、beta 更新檢查與安裝。

理由：
- 目前功能等價的核心在桌面能力，不只是打包器替換。
- 以 command API 封裝可讓前端保留現有資料流與 toast/錯誤顯示邏輯。

替代方案：
- 先只完成基本檔案操作，把縮放與更新延後。否決，因為需求已明確要求不改變原有功能且 beta 需可發佈。

### Decision: Isolate beta delivery by branch, tags, release assets, and updater metadata

採用 `beta` 長期分支承接 Tauri 開發；平時 push 只做驗證，只有 `beta-v*` tag 觸發 GitHub pre-release。beta release 資產、更新 metadata、版本文案與 stable Electron `v*` release 完全分離。

理由：
- 可避免 `main` 上既有 Electron release workflow 被新的 Tauri 流程污染。
- pre-release 與獨立 tag 規則可防止 beta 資產成為 GitHub latest。

替代方案：
- 每次 `beta` push 都直接發佈。否決，因為 release 噪音高，且 updater metadata 容易被頻繁覆蓋。

### Decision: Allow optional platform signing while requiring updater signing for beta updates

CI 以「能簽就簽，缺少憑證時降級」為原則。Windows/macOS 平台簽章與 notarization 為可選 secrets；Tauri updater 所需的簽章金鑰與 beta channel metadata 為必要條件。若平台簽章 secrets 缺失，流程仍產出可測試的 beta artifact。

理由：
- 使用者已明確表示可能無法提供付費開發者憑證。
- updater 若無獨立簽章與 channel 隔離，beta 自動更新就不可靠。

替代方案：
- beta 階段完全不做任何簽章。否決，因為需求已包含 beta 自動更新。

## Risks / Trade-offs

- [Tauri API 與 Electron 行為差異] → 以共享錯誤碼與 bridge 型別吸收平台差異，前端只吃標準化結果。
- [beta updater 需要額外 release metadata 管理] → 將 metadata 與 release 資產命名固定為 beta 專用，並在 workflow 中集中產生。
- [缺少商業簽章造成某些平台安裝警告] → 在 beta 文件中明確標註，且不要讓缺失阻斷所有平台構建。
- [現有程式散落使用 `window.ipcRenderer`] → 先抽 bridge，再切換 runtime，避免同時重寫 UI 與桌面層。
