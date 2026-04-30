## ADDED Requirements

### Requirement: Stable updater manifest publication
The stable release pipeline SHALL generate a stable updater manifest that declares the latest stable version, release notes summary, publication timestamp, and platform-specific download URLs with signatures for every supported desktop target.

#### Scenario: Manifest generated from release assets
- **WHEN** a stable tag release completes asset collection
- **THEN** the pipeline SHALL generate a stable updater manifest from the collected macOS, Windows, and Linux updater assets

#### Scenario: Manifest published to stable endpoint
- **WHEN** the stable release publish job succeeds
- **THEN** the pipeline SHALL update the repository-backed stable updater endpoint with the newly generated manifest

### Requirement: Stable updater signing prerequisites
The stable release pipeline MUST fail before publishing a stable release when stable updater signing or endpoint configuration is incomplete.

#### Scenario: Missing updater secret
- **WHEN** any required stable updater secret or endpoint value is absent
- **THEN** the release workflow SHALL stop before publishing release assets
