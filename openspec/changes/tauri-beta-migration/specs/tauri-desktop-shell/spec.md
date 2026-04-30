## ADDED Requirements

### Requirement: Tauri shell SHALL preserve current file operation behavior

The Tauri desktop shell SHALL support selecting files, selecting a destination directory, renaming files with collision detection, and copying renamed files while preserving the current renderer workflow and result semantics.

#### Scenario: User renames files successfully

- **WHEN** the renderer submits a batch rename request with valid non-conflicting target paths
- **THEN** the Tauri shell SHALL rename each file and return success results compatible with the current renderer flow

#### Scenario: User attempts to rename onto an existing file

- **WHEN** the renderer submits a rename request with `failOnExist` enabled and a target path already exists
- **THEN** the Tauri shell SHALL return a conflict error for that item without silently overwriting the target

### Requirement: Tauri shell SHALL preserve current window and integration behaviors

The Tauri desktop shell SHALL preserve current desktop integration behavior for external link opening, zoom control, and close protection when pending rename changes exist.

#### Scenario: User opens an external website

- **WHEN** the renderer requests to open an external URL
- **THEN** the Tauri shell SHALL delegate the URL to the host operating system browser

#### Scenario: User attempts to close the window with pending changes

- **WHEN** pending rename changes exist and the user attempts to close the application window
- **THEN** the Tauri shell SHALL prompt for confirmation before allowing the window to close

### Requirement: Tauri beta builds SHALL support beta update checks

The Tauri beta application SHALL retrieve update information from the beta release channel and SHALL NOT consume stable Electron release metadata.

#### Scenario: Beta build checks for updates

- **WHEN** a beta Tauri build checks for updates
- **THEN** it SHALL resolve release metadata from the beta update channel only

#### Scenario: Stable Electron release exists

- **WHEN** a stable Electron release with a newer stable tag exists
- **THEN** the beta Tauri build SHALL ignore that stable release unless a corresponding beta release is available in the beta channel
