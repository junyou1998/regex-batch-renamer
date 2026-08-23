# Regex Batch Renamer v0.6.0

🎉 Major Feature Release / 重大功能發布

## 🤖 AI 自然語言智慧更名 (AI-Powered Natural Language Renaming)

本次版本迎來重大升級 —— 正式導入 **AI 自然語言智慧更名助理**！無需再手動苦思複雜的正規表達式，只要用日常語言描述您的命名需求，AI 便會即時分析檔案規律並自動建構精準的更名規則流程。

---

### ✨ Core AI Capabilities / 核心 AI 功能亮點

- **自然語言對話生成規則管線 (Natural Language Pipeline Generation)**：
  - 支援以自然語言描述任何複雜的多步驟更名需求（例如：「*幫我把檔名中的日期提取移到最前面用橫線連接、清除壓制組標籤、並在集數後方加上兩位數序號補零*」）。
  - AI 自動分析目前載入工作區的檔案名稱特徵，直接推導出最佳的正規表達式、字串替換與序號變數（如 `${n:2}`）組合。

- **多輪對話與即時規則重構 (Multi-Turn Interactive Refinement)**：
  - 支援多輪對話疊加與修改：在與 AI 互動過程中，AI 會根據前次溝通結果持續微調或重新覆寫規則管線。
  - 每次生成均附帶「💡 技術邏輯與正則解析」，詳細說明每個正則步驟的比對原理與分組捕獲邏輯，讓更名過程完全透明且具可控性。
  - 支援「即時自動套用」與歷史版本單鍵「套用此版本規則」，隨時在不同 AI 方案間切換。

- **本機雙引擎免 API Key 整合 (Zero-Config Dual Local AI Engines)**：
  - **Claude Code CLI**：直接調用本機已登入的 Claude CLI，享受您的訂閱帳號額度與最新模型。
  - **OpenAI Codex CLI**：支援調用本機已登入的 OpenAI Codex CLI，免去設定 API Key 與額外計費的繁瑣步驟。
  - 智慧環境探測：自動搜尋系統路徑、Homebrew、NVM、Cargo 等環境中的 CLI 執行檔，並於設定中提供即時狀態監控與一鍵切換。

- **側欄即時預覽體驗 (Non-Blocking Split-Pane Experience)**：
  - AI 對話面板與檔案清單無縫並存，使用者在輸入指令與 AI 思考生成的同時，可即時查看中間檔案列表的動態預覽結果，所說即所見。

---

## 📥 Installation / 安裝說明

### macOS Users / macOS 使用者

> ⚠️ Note / 注意事項
> Since this app is not signed with an Apple Developer Certificate, you might see an "App is damaged" error.
> 由於軟體未經 Apple 開發者簽章，開啟時可能會出現 「應用程式已損毀」 的錯誤。

Please run the following command in Terminal to fix it:
請開啟終端機 (Terminal) 執行以下指令修復：
```bash
sudo xattr -r -d com.apple.quarantine "/Applications/Regex Batch Renamer.app"
```
