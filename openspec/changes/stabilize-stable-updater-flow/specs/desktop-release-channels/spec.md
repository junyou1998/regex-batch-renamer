## ADDED Requirements

### Requirement: Stable channel update fallback visibility
The desktop application SHALL continue checking the latest stable release metadata when the native updater path returns no available update, so users can still be informed that a newer stable version exists.

#### Scenario: Native updater unavailable
- **WHEN** the native updater check returns no available update or cannot provide release details
- **THEN** the desktop application SHALL compare the installed version against the latest stable GitHub release and surface an update prompt when a newer version exists

### Requirement: Stable channel manual verification guidance
The repository SHALL document a manual verification flow for validating stable in-app updates between two consecutive stable versions.

#### Scenario: Release verification reference
- **WHEN** maintainers prepare a new stable release
- **THEN** they SHALL be able to follow documented steps to verify `old version -> new version` update detection, installation, and post-restart version confirmation
