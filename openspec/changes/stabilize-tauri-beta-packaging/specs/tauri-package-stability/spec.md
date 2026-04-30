## ADDED Requirements

### Requirement: Tauri beta builds SHALL use platform-appropriate bundle targets

The project SHALL select Tauri bundle targets based on the current platform and release context instead of using a fixed `all` bundle target.

#### Scenario: Developer builds on macOS

- **WHEN** a developer runs the local Tauri build on macOS
- **THEN** the build SHALL request only the macOS bundle targets required for beta validation

#### Scenario: Beta release workflow runs on multiple platforms

- **WHEN** the beta release workflow runs on macOS, Windows, and Linux
- **THEN** each job SHALL request only the bundle targets supported and required for that platform

### Requirement: Beta updater packaging SHALL NOT depend on DMG generation

The beta release process SHALL generate updater-compatible artifacts without requiring DMG packaging on macOS.

#### Scenario: macOS beta release is built

- **WHEN** the macOS beta release job completes successfully
- **THEN** updater-compatible artifacts SHALL be produced from the application bundle without requiring a DMG file
