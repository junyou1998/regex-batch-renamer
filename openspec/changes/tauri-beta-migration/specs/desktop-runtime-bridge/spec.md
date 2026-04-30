## ADDED Requirements

### Requirement: Renderer SHALL use a runtime-agnostic desktop bridge

The renderer SHALL access desktop capabilities through a shared desktop bridge module instead of referencing Electron globals or Tauri globals directly from Vue components, stores, or services.

#### Scenario: Component triggers file selection

- **WHEN** a renderer component needs to select files
- **THEN** it SHALL call the shared desktop bridge API rather than a runtime-specific global object

#### Scenario: Renderer build targets a different desktop runtime

- **WHEN** the desktop runtime implementation changes from Electron to Tauri
- **THEN** renderer business logic SHALL remain unchanged except for importing the shared bridge

### Requirement: Desktop bridge SHALL standardize desktop operation contracts

The desktop bridge SHALL define shared request and response types for file selection, directory selection, rename, copy, external link opening, platform detection, zoom control, dirty-state close protection, and update operations.

#### Scenario: Rename operation returns a conflict

- **WHEN** a runtime reports that the target file already exists
- **THEN** the bridge SHALL return a stable error code that the renderer can map to the existing conflict UI

#### Scenario: Bridge reports platform information

- **WHEN** the renderer requests desktop environment metadata
- **THEN** the bridge SHALL return normalized platform and channel information without exposing runtime-specific internals
