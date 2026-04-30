## ADDED Requirements

### Requirement: Beta delivery SHALL be isolated from stable Electron delivery

The project SHALL maintain a beta delivery channel for Tauri development that is isolated from the stable Electron release flow by branch policy, tag naming, release type, and workflow triggers.

#### Scenario: Stable Electron release is published

- **WHEN** a `v*` tag is pushed from the stable line
- **THEN** only the stable Electron release workflow SHALL publish assets for that tag

#### Scenario: Beta Tauri release is published

- **WHEN** a `beta-v*` tag is pushed from the beta line
- **THEN** only the beta Tauri release workflow SHALL publish assets as a GitHub pre-release

### Requirement: Beta workflows SHALL distinguish validation from publication

The project SHALL run validation builds on beta branch pushes and SHALL reserve GitHub release publication for explicit beta release tags.

#### Scenario: Developer pushes commits to beta

- **WHEN** commits are pushed to the `beta` branch without a beta release tag
- **THEN** CI SHALL run validation steps without creating or updating a GitHub release

#### Scenario: Developer creates a beta release tag

- **WHEN** a `beta-v*` tag is pushed
- **THEN** CI SHALL build distributable Tauri artifacts and publish or update the corresponding GitHub pre-release

### Requirement: Beta updater metadata SHALL be channel-specific

The project SHALL generate and publish updater metadata that references only beta release artifacts and SHALL keep that metadata separate from stable release assets.

#### Scenario: Beta updater metadata is generated

- **WHEN** the beta release workflow completes
- **THEN** the published updater metadata SHALL reference beta artifacts only

#### Scenario: Stable release metadata exists

- **WHEN** stable release assets exist in GitHub Releases
- **THEN** beta updater metadata SHALL remain unchanged unless a beta release workflow publishes a new beta version
