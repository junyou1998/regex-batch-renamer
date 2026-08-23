# Regex Batch Renamer v0.5.5

✨ Improvements & Fixes / 優化與修正

- **Cross-Platform Custom Checkboxes / 全平台一致性自訂 Checkbox**：
    - Replaced native browser checkboxes with fully customized, pixel-perfect checkbox components.
    - Achieved 100% visual consistency across macOS (WebKit), Windows (WebView2), and Linux (WebKitGTK).
    - Refined vertical alignment between checkboxes and accompanying label text for a polished appearance.
    - 全面將原生瀏覽器勾選框替換為純自訂、像素級一致的 Checkbox 元件。
    - 在 macOS、Windows 及 Linux 上實現 100% 一致的外框、圓角、選取狀態與向量勾勾效果。
    - 精確調校 Checkbox 與標題文字的垂直中線對齊，消除字體基線落差。

- **Intuitive Sequence Number Helper / 更直覺的插入序號引導與即時預覽**：
    - Updated default sequence width to `1` (1-based digits) to remove the ambiguity between `0` and `1`.
    - Added a real-time preview panel in the helper modal to visualize sequence formats (e.g., `01, 02, 03...`) instantly as settings change.
    - Reduced user steps: one single click on `▲` directly configures 2-digit zero-padding (`01, 02`).
    - 將序號位數預設值改為直觀的 `1` 起點，消除原本 `0` 與 `1` 效果重複的困惑。
    - 在插入序號彈窗內新增「即時效果預覽」區塊，調整位數或起始值時即時呈現數字範例（如 `01, 02, 03...`）。
    - 簡化操作步驟：想要兩位數補零只需點擊一下 `▲` 即可直接完成設定。

- **UI Layout & Zoom Alignment Polish / 介面排版與縮放對齊修正**：
    - Reorganized rule card header by moving all status badges to a dedicated second row, preventing title text wrapping in English.
    - Ordered badges by priority: mode type first (`REGEX` / `TEXT`), followed by rule features (`SEQUENCE`, `PREFIX`, `SUFFIX`).
    - Implemented dynamic zoom compensation for the macOS sidebar toggle button, keeping it perfectly aligned with native traffic lights across all zoom levels (80% - 200%).
    - 重新整理規則卡片排版，將所有 Badges 集中至第二行專屬列，徹底解決英文語系下標題因空間不足而折行的問題。
    - 規範 Badges 呈現順序：類型標籤優先（`REGEX` / `TEXT`），接續特性標籤（`SEQUENCE`、`PREFIX`、`SUFFIX`）。
    - 為 macOS 頂部收合按鈕引入介面縮放動態補償算法，在任意縮放比例（80% ~ 200%）下與原生紅綠燈均保持恆定安全間距，杜絕錯位。

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
