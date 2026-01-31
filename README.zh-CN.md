# Regex Batch Renamer

[繁體中文](README.zh-TW.md) | **简体中文** | [English](README.md)

🌐 **官方网站**: https://renamer.junyou.tw/

<img src="public/icon.png" align="left" width="128" style="margin-right: 24px; margin-bottom: 12px;" alt="App Icon" />

一个强大且直观的跨平台批量重命名工具 (支持 Windows / macOS / Linux)。支持正则表达式 (Regex)、纯文本替换以及流水号功能，让繁琐的文件重命名工作变得轻松简单。

<br clear="left"/>

<img src="public/screenshot.png" alt="App Screenshot" width="800" />

## ✨ 主要功能

- **直观操作**：支持拖拽文件 (Drag & Drop) 与即时预览重命名结果。
- **双重模式**：
    - **Regex 模式**：支持完整的正则表达式语法，适合进阶用户。
    - **纯文本模式**：自动处理转义字符，直观替换 `[]`、`()` 等特殊符号。
- **流水号功能**：使用 `${n}` 语法轻松插入递增数字，并支持补零 (如 `${n:03}`)。
- **现代化界面**：采用质感设计，并完整支持 macOS 浅色/深色模式 (可跟随系统)。
- **安全可靠**：执行前可完整预览，并支持「复制到...」功能以保留原始文件。

## 📥 安装说明

### macOS 用户注意事项

由于本软件未经 Apple 开发者签名（因为我是独立开发者），在 macOS 上安装后首次打开可能会出现 **“应用已损坏，无法打开”** 的错误提示。这是 macOS 的安全机制所致，并非软件真的损坏。

请打开终端 (Terminal)，并执行以下指令来修复：

```bash
sudo xattr -r -d com.apple.quarantine /Applications/Regex\ Batch\ Renamer.app
```

执行后输入密码即可正常打开。

### Windows / Linux

直接下载对应的安装包运行即可。

## 🚀 快速开始

1. **加入文件**：将想要重命名的文件拖曳至左上角的区域，或点击按钮选择文件。
2. **新增规则**：在左侧「操作流程」中点击「+ 新增规则」。
3. **设定条件**：
    - 输入「查找目标」与「替换为」的内容。
    - 勾选/取消勾选「使用正则表达式 (Regex)」来切换模式。
4. **预览结果**：右侧列表会即时显示重命名后的预览，变更部分会以高亮显示。
5. **执行重命名**：确认无误后，点击「执行重命名」直接修改，或「复制到...」将重命名后的文件复制到新位置。

## 📖 进阶教学

### 流水号 (${n})

在「替换为」字段中使用 `${n}` 来插入序号：

- `${n}`：1, 2, 3...
- `${n:03}`：001, 002, 003...

### 常用 Regex 范例

- **删除空白**：查找 `\s+`，替换为 `(留空)`
- **统一日期**：查找 `(\d{4})(\d{2})(\d{2})`，替换为 `$1-$2-$3` (将 20231125 转为 2023-11-25)

_更多教学请点击软件界面中的「？」按钮查看。_

## 🛠️ 使用技术

本项目使用以下现代化网页技术构建：

- **核心框架**：[Electron](https://www.electronjs.org/)
- **前端框架**：[Vue 3](https://vuejs.org/) (Composition API)
- **语言**：[TypeScript](https://www.typescriptlang.org/)
- **样式**：[Tailwind CSS](https://tailwindcss.com/)
- **构建工具**：[Vite](https://vitejs.dev/)
- **状态管理**：[Pinia](https://pinia.vuejs.org/)

## ☕ 赞助开发

如果您觉得这个工具对您有帮助，欢迎赞助我一杯咖啡，这将成为我持续开发与维护的动力！

<a href="https://www.buymeacoffee.com/junyou" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## 📄 授权

MIT License
