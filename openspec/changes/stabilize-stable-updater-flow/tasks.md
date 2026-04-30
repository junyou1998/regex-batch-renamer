## 1. Release Pipeline

- [x] 1.1 Implement Stable updater signing prerequisites fail-fast checks in the stable release workflow.
- [x] 1.2 Implement Stable updater manifest publication and Release workflow SHALL generate stable updater manifest from collected platform assets.
- [x] 1.3 Implement Stable updater endpoint SHALL be repository-backed and immutable by tag contents, with Manifest published to stable endpoint in the stable release publish job.

## 2. Application Fallback And Docs

- [x] 2.1 Implement Stable channel update fallback visibility and App update check SHALL fall back to GitHub release comparison when updater is unavailable in the desktop application.
- [x] 2.2 Implement Stable channel manual verification guidance in repository documentation.

## 3. Asset Mapping And In-App Install

- [x] 3.1 Implement Release asset naming SHALL be deterministic across uploaded artifacts and manifest URLs in the stable release workflow and updater manifest generator.
- [x] 3.2 Implement macOS in-app installation and macOS install flow SHALL stage and swap the application bundle after verified updater download in the Tauri desktop bridge and Rust updater command.
- [x] 3.3 Implement manual verification updates for `v0.5.2 -> v0.5.3+` and confirm the local in-app update flow against the repository-backed stable manifest.

## 4. Release Notes Experience

- [x] 4.1 Implement Stable release notes history visibility in `src/services/updateService.ts` and `src/components/AboutModal.vue`, and release notes UI SHALL read GitHub release history directly with per-version links.
- [x] 4.2 Implement Post-update release note prompt in `src/App.vue` and `src/components/AboutModal.vue`, and post-update notice SHALL be driven by a persisted target version marker before install and auto-open after restart.
- [x] 4.3 Implement local verification for release history rendering and post-update release note prompt, then update repository guidance if the verification flow changes.
