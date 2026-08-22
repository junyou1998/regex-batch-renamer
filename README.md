# Regex Batch Renamer

[繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | **English**

🌐 **Official Website**: https://renamer.junyou.tw/

<img src="public/icon.png" align="left" width="128" style="margin-right: 24px; margin-bottom: 12px;" alt="App Icon" />

A powerful, ultra-lightweight, and intuitive cross-platform batch file renaming tool (macOS / Windows / Linux). Built on **Tauri v2 + Vue 3 + Tailwind CSS v4 + Rust**, supporting Regular Expressions (Regex), plain text replacement, customizable quick templates, and sequential numbering to make tedious renaming tasks seamless and enjoyable.

<br clear="left"/>
<br />

<img src="public/screenshot.png" alt="App Screenshot" width="800" />

## ✨ Key Features

- **Intuitive Workflow**: Drag & Drop file importing with live highlighted preview of renaming outcomes.
- **Dual Renaming Modes**:
    - **Regex Mode**: Full Regular Expression support for advanced batch operations.
    - **Plain Text Mode**: Automatically handles special characters, intuitively replacing symbols like `[]`, `()`, and whitespaces.
- **Flexible Sequence Numbering**: Use `$n` or `${n}` syntax to insert incrementing numbers with custom starting index and zero-padding (e.g., `${n:2}` or `001`).
- **Quick & Custom Templates**: Built-in common templates (remove spaces, convert to underscores, replace all with sequence), plus the ability to save custom rule pipelines as presets.
- **Safety & Protection**:
    - Real-time conflict detection before execution.
    - "Create Copy" option to preserve original files.
    - **Window Close Protection**: Intercepts close requests when unsaved/pending changes exist, preventing accidental data loss.
- **Modern Polished Interface**: Native immersive titlebar with collapsible sidebar, supporting Dark and Light themes across macOS, Windows, and Linux.

## 📥 Installation

Download the latest release from [GitHub Releases](https://github.com/junyou1998/regex-batch-renamer/releases):

- **macOS**: Apple Silicon (`.dmg`) and Intel installers.
- **Windows**: 64-bit installer (`.exe`).
- **Linux**: AppImage and `.deb` packages.

### macOS Users Note

If an unsigned macOS build triggers a Gatekeeper warning, clear the quarantine attribute via terminal:

```bash
xattr -r -d com.apple.quarantine "/Applications/Regex Batch Renamer.app"
```

## 🚀 Quick Start

1. **Import Files**: Drag & drop files into the app window or click "Add Files / Add Folder".
2. **Add Rules**: Click "+ Add Rule" or choose from "⚡ Quick Templates" in the left pipeline.
3. **Configure Settings**:
    - Enter "Find" and "Replace with" patterns.
    - Toggle "Use Regex" mode as needed.
4. **Preview Changes**: View live changes highlighted in the table on the right.
5. **Execute**: Click "Rename Files" to apply changes in-place, or "Create Copy" to duplicate renamed files into a new folder.

## 📖 Useful Tips

### Sequence Numbering ($n)

Use sequence variables in the "Replace with" field:
- `${n}`: 1, 2, 3...
- `${n:2}` or `${n:03}`: 01, 02, 03... / 001, 002, 003...

### Common Regex Examples

- **Remove Whitespace**: Find `\s+`, Replace with `(Leave Empty)`
- **Standardize Date**: Find `(\d{4})(\d{2})(\d{2})`, Replace with `$1-$2-$3` (20231125 → 2023-11-25)
- **Remove Parentheses & Content**: Find `\s*\([^)]*\)`, Replace with `(Leave Empty)`

## 🛠️ Tech Stack & Development

Built with a high-performance modern tech stack:

- **Desktop Framework**: [Tauri v2](https://v2.tauri.app/) (Lightweight & secure Rust backend)
- **Frontend Framework**: [Vue 3](https://vuejs.org/) (Composition API + `<script setup>`)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Programming Languages**: [TypeScript](https://www.typescriptlang.org/) + [Rust](https://www.rust-lang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Internationalization**: [Vue I18n](https://vue-i18n.intlify.dev/)

### Local Development Commands

```bash
# Install dependencies (pnpm preferred)
pnpm install

# Start development mode with Vite hot-reloading & Rust backend
pnpm run dev

# Type-check and verify frontend build
pnpm run tauri:ci

# Build production desktop release
pnpm run build
```

## ☕ Support Development

If you find this tool helpful, consider buying me a coffee to support continued development!

<a href="https://www.buymeacoffee.com/junyou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## 📄 License

[MIT License](LICENSE)
