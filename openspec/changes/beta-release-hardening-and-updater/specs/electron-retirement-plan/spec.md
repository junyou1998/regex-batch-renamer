## ADDED Requirements

### Requirement: Repo documents Electron retirement gates
The repository SHALL document the conditions that must be satisfied before Electron-specific code paths are removed.

#### Scenario: Maintainer prepares post-beta cleanup
- **WHEN** a maintainer reviews the Electron retirement plan
- **THEN** the document SHALL list release, updater, QA, and rollback gates that must be met before deleting Electron code

### Requirement: Repo documents phased Electron removal order
The repository SHALL document a phased removal order for Electron-related code and workflows.

#### Scenario: Maintainer starts cleanup work
- **WHEN** a maintainer begins deleting Electron artifacts
- **THEN** the document SHALL identify the order for removing runtime code, build scripts, CI workflows, and package dependencies
