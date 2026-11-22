//! One-time rename of the macOS app bundle after the Regex Batch Renamer → Renamix rebrand.
//!
//! The updater replaces the bundle in place, so existing installs keep the old folder name
//! ("Regex Batch Renamer.app") even though the app inside is Renamix — and Finder, the Dock
//! and Launchpad show the folder name. On launch we rename a bundle that still has a legacy
//! name, then relaunch from the new path so later updates are installed there too.

use std::path::{Path, PathBuf};

const LEGACY_BUNDLE_NAMES: &[&str] = &["Regex Batch Renamer.app"];
const BUNDLE_NAME: &str = "Renamix.app";

/// Where a legacy-named bundle should move to, or `None` if it should be left alone
/// (already renamed, renamed by the user to something else, or `Renamix.app` already exists).
pub fn migration_target(bundle: &Path) -> Option<PathBuf> {
    let name = bundle.file_name()?.to_str()?;
    if !LEGACY_BUNDLE_NAMES.contains(&name) {
        return None;
    }
    let target = bundle.with_file_name(BUNDLE_NAME);
    if target.exists() {
        return None;
    }
    Some(target)
}

/// Renames the running bundle if needed and relaunches it. Returns `true` when the caller
/// should exit because the renamed copy has been launched. Any failure (read-only folder,
/// App Translocation, missing permission) leaves the app where it is and keeps running.
#[cfg(target_os = "macos")]
pub fn migrate_and_relaunch() -> bool {
    let Some(bundle) = std::env::current_exe().ok().and_then(|exe| {
        exe.ancestors()
            .find(|p| p.extension().and_then(|e| e.to_str()) == Some("app"))
            .map(Path::to_path_buf)
    }) else {
        return false;
    };
    let Some(target) = migration_target(&bundle) else {
        return false;
    };
    if std::fs::rename(&bundle, &target).is_err() {
        return false;
    }
    match std::process::Command::new("/usr/bin/open").arg("-n").arg(&target).spawn() {
        Ok(_) => true,
        Err(_) => {
            // Couldn't relaunch: put it back so the running process and the bundle agree.
            let _ = std::fs::rename(&target, &bundle);
            false
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn migrate_and_relaunch() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renames_only_legacy_bundles() {
        let dir = std::env::temp_dir().join(format!("renamix-bundle-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();

        let legacy = dir.join("Regex Batch Renamer.app");
        assert_eq!(migration_target(&legacy), Some(dir.join("Renamix.app")));

        // Already renamed, or renamed by the user to something else: leave it.
        assert_eq!(migration_target(&dir.join("Renamix.app")), None);
        assert_eq!(migration_target(&dir.join("My Renamer.app")), None);

        // A fresh Renamix.app next to it: never overwrite.
        std::fs::create_dir_all(dir.join("Renamix.app")).unwrap();
        assert_eq!(migration_target(&legacy), None);

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
