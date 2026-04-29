## 1. Stable Release Workflow

- [ ] 1.1 Implement Stable release is produced by Tauri in .github/workflows/release.yml and keep Beta prerelease channel is preserved in .github/workflows/beta-release.yml.
- [ ] 1.2 Implement Build config derives release channel identity across scripts/prepare-tauri-release-config.mjs, src-tauri/tauri.conf.json, src-tauri/tauri.beta.conf.json, src-tauri/tauri.release.conf.json, src-tauri/src/lib.rs, and version files.

## 2. App Update Flow

- [ ] 2.1 Implement App automatically checks for updates on launch and Tauri launch update check prefers in-app installation in src/App.vue.
- [ ] 2.2 Align About modal and desktop bridge update behavior for stable and beta channels in src/components/AboutModal.vue, src/services/desktop/tauri.ts, src/services/desktop/electron.ts, and src/services/updateService.ts.

## 3. Stable Cutover

- [ ] 3.1 Switch default package scripts and docs to Tauri stable while documenting retained beta workflow in package.json, README.md, and README.zh-TW.md.
- [ ] 3.2 Merge beta into main and create the v0.5.0 stable release tag after verification.
