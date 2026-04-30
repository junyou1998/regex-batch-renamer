## ADDED Requirements

### Requirement: Stable updater manifest publication
The stable release pipeline SHALL generate a stable updater manifest that declares the latest stable version, release notes summary, publication timestamp, and platform-specific download URLs with signatures for every supported desktop target.

#### Scenario: Manifest generated from release assets
- **WHEN** a stable tag release completes asset collection
- **THEN** the pipeline SHALL generate a stable updater manifest from the collected macOS, Windows, and Linux updater assets

##### Example:
- **GIVEN** the macOS release assets include `Regex.Batch.Renamer_aarch64.app.tar.gz` and `Regex.Batch.Renamer_x64.app.tar.gz`
- **AND** the Windows release assets include `Regex.Batch.Renamer_0.5.3_x64-setup.exe`
- **AND** the Linux release assets include `Regex.Batch.Renamer_0.5.3_amd64.AppImage`
- **WHEN** the publish job generates `stable.json`
- **THEN** the manifest SHALL point to GitHub Release download URLs with those exact file names
- **AND** each platform entry SHALL include the matching signature content from the collected `.sig` file

#### Scenario: Manifest published to stable endpoint
- **WHEN** the stable release publish job succeeds
- **THEN** the pipeline SHALL update the repository-backed stable updater endpoint with the newly generated manifest

##### Example:
- **GIVEN** tag `v0.5.3` finished release publication
- **WHEN** the publish job pushes back to `main`
- **THEN** `updater/stable.json` SHALL declare version `0.5.3`
- **AND** its macOS URLs SHALL end with `Regex.Batch.Renamer_aarch64.app.tar.gz` and `Regex.Batch.Renamer_x64.app.tar.gz`
- **AND** its Windows URL SHALL end with `Regex.Batch.Renamer_0.5.3_x64-setup.exe`

### Requirement: Stable updater signing prerequisites
The stable release pipeline MUST fail before publishing a stable release when stable updater signing or endpoint configuration is incomplete.

#### Scenario: Missing updater secret
- **WHEN** any required stable updater secret or endpoint value is absent
- **THEN** the release workflow SHALL stop before publishing release assets

##### Example:
- **GIVEN** `TAURI_UPDATER_PUBKEY` is unset in the workflow environment
- **WHEN** the stable release workflow reaches the updater verification step
- **THEN** the workflow SHALL exit before `Publish stable release`
