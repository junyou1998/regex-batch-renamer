## ADDED Requirements

### Requirement: Beta releases are created as draft prereleases
The beta release workflow SHALL create GitHub releases as both draft and prerelease so maintainers can review assets before publication.

#### Scenario: Tag-triggered beta build completes
- **WHEN** a `beta-v*` tag triggers the beta release workflow
- **THEN** the workflow SHALL create or update a GitHub release with `draft=true`
- **AND** the release SHALL keep `prerelease=true`

### Requirement: Only distributable beta assets are published
The beta release workflow SHALL publish only distributable installer artifacts and updater artifacts, and SHALL NOT upload packaging internals such as Debian control tarballs.

#### Scenario: Linux bundle collection runs
- **WHEN** Linux assets are collected for release
- **THEN** the workflow SHALL include `.AppImage`, `.deb`, and updater signatures or archives
- **AND** the workflow SHALL NOT include `control.tar.gz` or `data.tar.gz`

### Requirement: macOS beta release includes architecture-specific DMGs
The beta release workflow SHALL produce separate macOS DMG assets for Apple Silicon and Intel runners.

#### Scenario: macOS matrix jobs succeed
- **WHEN** the arm64 and x64 macOS jobs complete successfully
- **THEN** the resulting release draft SHALL contain one DMG from the Apple Silicon runner
- **AND** the resulting release draft SHALL contain one DMG from the Intel runner
