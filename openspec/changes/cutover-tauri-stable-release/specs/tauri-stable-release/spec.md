## ADDED Requirements

### Requirement: Stable release is produced by Tauri
The repository SHALL publish stable desktop releases from Tauri when a `v*` tag is pushed from the main release line.

#### Scenario: Stable release tag is pushed
- **WHEN** a maintainer pushes a `v0.5.0` tag
- **THEN** GitHub Actions SHALL build Tauri artifacts for macOS, Windows, and Linux
- **AND** GitHub Actions SHALL publish a non-draft, non-prerelease GitHub release for that tag

### Requirement: Beta prerelease channel is preserved
The repository SHALL preserve the existing beta prerelease channel after stable Tauri cutover.

#### Scenario: Beta release tag is pushed after stable cutover
- **WHEN** a maintainer pushes a `beta-v*` tag
- **THEN** GitHub Actions SHALL continue to create a beta draft prerelease
- **AND** the beta release SHALL use beta-specific app identity and updater metadata
