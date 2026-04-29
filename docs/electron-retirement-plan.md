# Electron Retirement Plan

This document defines when the repository is allowed to remove Electron-specific code after the Tauri beta line is validated.

## Removal Gates

Electron code SHALL NOT be removed until all of the following are true:

1. The Tauri beta line has completed at least one reviewed multi-platform draft release covering macOS, Windows, and Linux.
2. The Tauri beta app can complete file import, rename, copy-to, drag sorting, and in-app update checks without regression on the supported desktop platforms.
3. The updater path for Tauri beta is operational for published releases, including valid updater artifacts and platform installation flow.
4. The stable release owner confirms that `main` no longer needs Electron as the only production release line.
5. A rollback path exists for the most recent stable Electron release tag and release artifacts.

## Phased Removal Order

When the gates are satisfied, Electron cleanup SHALL happen in this order:

1. Stop routing any beta validation or beta release workflow through Electron-specific commands.
2. Remove Electron-only renderer bridge code that is no longer referenced by any maintained branch strategy.
3. Remove `electron/` runtime files and Electron-only type declarations.
4. Remove Electron build scripts from `package.json` and any remaining Electron packaging configuration.
5. Remove Electron release workflows and release documentation that no longer apply.
6. Remove unused Electron dependencies from `package.json` and refresh the lockfile.

## Rollback Strategy

- Preserve the last known-good Electron stable tag and GitHub release.
- Keep a dedicated branch or tag reference for the final Electron stable state before deletion starts.
- Delete Electron code in small reviewable changes so a single revert can restore the previous stage.

## Audit Checklist Before Deletion

- Verify `beta` branch release artifacts are manually reviewed from draft to published successfully.
- Verify Tauri updater metadata resolves from the configured endpoint for at least one published beta release.
- Verify documentation and support links no longer instruct beta users to use Electron installers.
- Verify no active GitHub Actions workflow still references Electron-only build outputs for the beta line.
