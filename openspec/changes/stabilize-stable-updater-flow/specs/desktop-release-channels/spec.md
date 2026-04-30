## ADDED Requirements

### Requirement: Stable channel update fallback visibility
The desktop application SHALL continue checking the latest stable release metadata when the native updater path returns no available update, so users can still be informed that a newer stable version exists.

#### Scenario: Native updater unavailable
- **WHEN** the native updater check returns no available update or cannot provide release details
- **THEN** the desktop application SHALL compare the installed version against the latest stable GitHub release and surface an update prompt when a newer version exists

##### Example:
- **GIVEN** the installed version is `0.5.2`
- **AND** `updater/stable.json` cannot be used to provide an update result
- **AND** the latest stable GitHub release is `v0.5.3`
- **WHEN** the desktop application runs its startup update check
- **THEN** it SHALL still display that `0.5.3` is available

### Requirement: macOS in-app installation
The desktop application SHALL complete a verified in-app update installation on macOS when the app is running from a writable installed bundle location and the stable manifest references valid updater assets.

#### Scenario: Installed macOS app updates in place
- **WHEN** the installed macOS application downloads a newer stable `.app.tar.gz` from the stable updater manifest
- **THEN** the application SHALL stage the verified bundle outside the running app
- **AND** it SHALL exit, replace the current `.app`, and relaunch the new version

##### Example:
- **GIVEN** `/Applications/Regex Batch Renamer.app` is version `0.5.2`
- **AND** `updater/stable.json` references `Regex.Batch.Renamer_aarch64.app.tar.gz` for version `0.5.3`
- **WHEN** the user clicks `安裝更新`
- **THEN** the app SHALL restart into version `0.5.3`

### Requirement: Stable channel manual verification guidance
The repository SHALL document a manual verification flow for validating stable in-app updates between two consecutive stable versions.

#### Scenario: Release verification reference
- **WHEN** maintainers prepare a new stable release
- **THEN** they SHALL be able to follow documented steps to verify `old version -> new version` update detection, installation, and post-restart version confirmation
