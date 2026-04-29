## 1. Draft Beta Release Flow

- [x] 1.1 Implement Beta releases are created as draft prereleases and macOS beta release includes architecture-specific DMGs in .github/workflows/beta-release.yml.
- [x] 1.2 Implement Only distributable beta assets are published, then clean obsolete beta tags and releases and re-issue the target beta tag for the updated draft workflow.

## 2. In-App Updater

- [x] 2.1 Implement About dialog shows runtime version and Use runtime-reported version for app update UI across src-tauri/src/lib.rs, src/services/desktop/types.ts, src/services/desktop/electron.ts, and src/services/desktop/tauri.ts.
- [x] 2.2 Implement Tauri app can install updates from inside the app and Prefer updater plugin for Tauri installs, keep GitHub release fetch for changelog in src/components/AboutModal.vue and locale files while keeping Changelog remains available without installing.

## 3. Electron Retirement Plan

- [x] 3.1 Implement Repo documents Electron retirement gates, Repo documents phased Electron removal order, and Document Electron retirement before deletion in docs/electron-retirement-plan.md and summarize the plan in README.md and README.zh-TW.md.
