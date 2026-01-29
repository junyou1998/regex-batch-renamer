# Regex Batch Renamer

[繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md) | **English**

🌐 **Official Website**: https://renamer.junyou.tw/

<img src="public/icon.png" align="left" width="128" style="margin-right: 24px; margin-bottom: 12px;" alt="App Icon" />

A powerful and intuitive cross-platform batch file renaming tool (Windows / macOS / Linux). Supports Regular Expressions (Regex), plain text replacement, and sequential numbering, making tedious file renaming tasks easy and simple.

<br clear="left"/>
<br />

<img src="public/screenshot.png" alt="App Screenshot" width="800" />

## ✨ Key Features

- **Intuitive Operation**: Supports Drag & Drop and real-time preview of renaming results.
- **Dual Modes**:
    - **Regex Mode**: Supports full Regular Expression syntax, suitable for advanced users.
    - **Plain Text Mode**: Automatically handles escape characters, intuitively replacing special symbols like `[]`, `()`.
- **Sequential Numbering**: Easily insert incrementing numbers using `${n}` syntax, with support for zero-padding (e.g., `${n:03}`).
- **Modern Interface**: Designed with a premium look and feel, fully supporting macOS Light/Dark modes (follows system settings).
- **Safe & Reliable**: Full preview before execution, and supports "Copy To..." to preserve original files.

## 📥 Installation

### macOS Users Note

Since this app is not signed with an Apple Developer Certificate (as I am an independent developer), you might encounter an **"App is damaged and can't be opened"** error when launching it for the first time on macOS. This is due to macOS security features, not because the app is actually damaged.

To resolve this, please open the Terminal and run the following command:

```bash
sudo xattr -r -d com.apple.quarantine /Applications/Regex\ Batch\ Renamer.app
```

Enter your password when prompted, and you should be able to open the app normally.

### Windows / Linux

Simply download and run the installer for your platform.

## 🚀 Quick Start

1. **Add Files**: Drag files to the top-left area or click the button to select files.
2. **Add Rule**: Click "+ Add Rule" in the "Operations" section on the left.
3. **Set Conditions**:
    - Enter content for "Find" and "Replace with".
    - Check/Uncheck "Use Regex" to switch modes.
4. **Preview Results**: The list on the right will show a real-time preview of the renamed files, with changes highlighted.
5. **Execute**: Once confirmed, click "Rename Files" to modify directly, or "Copy To..." to copy renamed files to a new location.

## 📖 Advanced Tutorial

### Sequential Numbering (${n})

Use `${n}` in the "Replace with" field to insert sequence numbers:

- `${n}`: 1, 2, 3...
- `${n:03}`: 001, 002, 003...

### Common Regex Examples

- **Remove Whitespace**: Find `\s+`, Replace with `(Empty)`
- **Standardize Date**: Find `(\d{4})(\d{2})(\d{2})`, Replace with `$1-$2-$3` (Converts 20231125 to 2023-11-25)

_For more tutorials, click the "?" button in the software interface._

## 🛠️ Technologies Used

This project is built using modern web technologies:

- **Core**: [Electron](https://www.electronjs.org/)
- **Frontend**: [Vue 3](https://vuejs.org/) (Composition API)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **State Management**: [Pinia](https://pinia.vuejs.org/)

## ☕ Support Development

If you find this tool helpful, consider buying me a coffee to support continued development!

<a href="https://www.buymeacoffee.com/junyou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## 📄 License

MIT License
