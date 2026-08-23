# Regex Batch Renamer v0.6.0

🎉 Major Feature Release / 重大功能發布

## ✨ Highlights / 功能亮點

### 1. 🤖 AI Smart Rule Assistant / AI 智慧規則助理 (Claude Code & OpenAI Codex)
- **Local AI CLI Integration (No API Key Required) / 本機 CLI 免 API Key 深度整合**：
  - Directly interact with locally logged-in **Claude Code CLI** (`claude`) or **OpenAI Codex CLI** (`codex`) to leverage your subscription quota and models.
  - Automatically analyzes loaded workspace file patterns, extracts features, and generates complete regular expression pipeline rules (`${n:2}`, capture groups, prefix/suffix).
  - 直接調用本機已登入的 **Claude Code CLI** 或 **OpenAI Codex CLI**，免額外購買 API Key 即可享受訂閱額度與強大推理模型。
  - 自然語言對話：即時分析載入的檔案命名特徵，自動建構包含正規表達式、序號補零（如 `${n:2}`）、捕獲群組等更名規則管線。

### 2. 🗂️ Collapsible 3-Column Layout & Auto-Resizing Input / 側欄式對話面板與自適應輸入框
- **Non-blocking Right Sidebar / 不遮蔽主畫面的右側收合面板**：
  - Replaced overlay drawers with a collapsible right sidebar panel, allowing users to watch file preview updates in real-time while chatting with AI.
  - 改用右側收合式側欄面板，與左側規則欄協同運作，對話時完整保留中間檔案清單與即時預覽視野。
- **Auto-Resizing Input with IME Protection / 輸入框動態伸縮與注音防誤觸**：
  - Auto-expands up to a max-height threshold when typing multi-line instructions (`Shift + Enter`).
  - Integrated `isComposing` protection against accidental Enter submissions during Chinese / Japanese IME candidate selection.
  - 輸入框支援多行自適應長高，並完整防護中文注音/拼音選字時誤觸發送。
  - 對話氣泡完整保留使用者輸入的原始換行與分點條列排版。

### 3. ⚙️ AI Settings Tab & Official Vector Logos / AI 設定分頁與官方專屬識別圖示
- **Dual AI Engine Switching / 雙引擎切換與狀態檢測**：
  - Select between Claude Code CLI and OpenAI Codex CLI, with live connection indicators, detected versions, and path info.
  - 設定彈窗新增專屬「AI 助理」分頁，可隨時切換預設引擎、檢測連線狀態與設定自動套用偏好。
- **Pixel-Perfect Vector Icons / 向量圖示**：
  - Integrated official **Claude 14-ray Asterisk** and **OpenAI Codex Cloud** SVG icons.
  - 完美整合 Claude 官方星芒圖示與 Codex 官方雲朵終端識別圖示。

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
