## ADDED Requirements

### Requirement: App automatically checks for updates on launch
The desktop application SHALL check for updates when the main window finishes loading.

#### Scenario: User opens the Tauri stable app
- **WHEN** the application starts and runtime information is available
- **THEN** the app SHALL perform an update check automatically
- **AND** the app SHALL surface an update banner when a newer version is available

### Requirement: Tauri launch update check prefers in-app installation
The desktop application SHALL prefer the Tauri updater plugin for launch-time update checks and installation when the active runtime is Tauri.

#### Scenario: Tauri updater reports an available stable release
- **WHEN** the startup update check runs in a Tauri runtime and the updater plugin reports an update
- **THEN** the app SHALL offer an action that installs the update without redirecting to GitHub Releases
