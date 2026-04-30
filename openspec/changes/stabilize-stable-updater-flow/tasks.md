## 1. Release Pipeline

- [x] 1.1 Implement Stable updater signing prerequisites fail-fast checks in the stable release workflow.
- [x] 1.2 Implement Stable updater manifest publication and Release workflow SHALL generate stable updater manifest from collected platform assets.
- [x] 1.3 Implement Stable updater endpoint SHALL be repository-backed and immutable by tag contents, with Manifest published to stable endpoint in the stable release publish job.

## 2. Application Fallback And Docs

- [x] 2.1 Implement Stable channel update fallback visibility and App update check SHALL fall back to GitHub release comparison when updater is unavailable in the desktop application.
- [x] 2.2 Implement Stable channel manual verification guidance in repository documentation.

## 3. Asset Mapping And In-App Install

- [ ] 3.1 Implement Release asset naming SHALL be deterministic across uploaded artifacts and manifest URLs in the stable release workflow and updater manifest generator.
- [ ] 3.2 Implement macOS install flow SHALL stage and swap the application bundle after verified updater download in the Tauri desktop bridge and Rust updater command.
- [ ] 3.3 Implement manual verification updates for `v0.5.2 -> v0.5.3+` and confirm the local in-app update flow against the repository-backed stable manifest.
