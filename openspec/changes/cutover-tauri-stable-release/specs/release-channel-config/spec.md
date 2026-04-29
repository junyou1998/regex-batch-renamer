## ADDED Requirements

### Requirement: Build config derives release channel identity
The desktop build system SHALL derive runtime channel identity, product naming, identifier, and updater endpoint from channel-aware build configuration.

#### Scenario: Stable build is produced from main
- **WHEN** a stable Tauri build is created
- **THEN** the bundle SHALL use the stable app identifier and product name
- **AND** the runtime SHALL report the `stable` channel

#### Scenario: Beta build is produced from beta release workflow
- **WHEN** a beta Tauri build is created
- **THEN** the bundle SHALL use the beta app identifier and product name
- **AND** the runtime SHALL report the `beta` channel
