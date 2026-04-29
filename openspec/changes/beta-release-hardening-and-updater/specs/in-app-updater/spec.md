## ADDED Requirements

### Requirement: About dialog shows runtime version
The desktop application SHALL display the version reported by the active desktop runtime instead of assuming the package manifest version.

#### Scenario: Beta app opens About dialog
- **WHEN** the user opens the About dialog in the Tauri beta application
- **THEN** the dialog SHALL display the runtime version returned by the desktop bridge

### Requirement: Tauri app can install updates from inside the app
The Tauri beta application SHALL provide an in-app update action when the updater plugin reports an available update.

#### Scenario: Updater plugin finds a new beta build
- **WHEN** the About dialog checks for updates and the updater plugin reports an available version
- **THEN** the dialog SHALL show the new version number
- **AND** the dialog SHALL show an action that installs the update without redirecting the user to GitHub Releases

### Requirement: Changelog remains available without installing
The About dialog SHALL continue to show release notes even when no in-app update is available.

#### Scenario: User opens changelog view
- **WHEN** the user requests the changelog from the About dialog
- **THEN** the application SHALL fetch and render the latest release notes for the active channel
