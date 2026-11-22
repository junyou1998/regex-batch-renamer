//! Runtime filesystem scope.
//!
//! The webview can only touch paths that the user explicitly handed to the app
//! through a native file/folder dialog or a drag-and-drop gesture. Every native
//! command that reads, renames or writes a file checks this registry, so a
//! compromised plugin or injected script cannot reach arbitrary paths such as
//! `~/.ssh`.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Default)]
pub struct FsScope {
    /// Files (or folders treated as rename targets) the user loaded into the list.
    items: Mutex<HashSet<PathBuf>>,
    /// Destination folders the user picked for "Copy To".
    destinations: Mutex<HashSet<PathBuf>>,
}

impl FsScope {
    pub fn allow_items<I, P>(&self, paths: I)
    where
        I: IntoIterator<Item = P>,
        P: AsRef<Path>,
    {
        if let Ok(mut items) = self.items.lock() {
            for path in paths {
                items.insert(path.as_ref().to_path_buf());
            }
        }
    }

    pub fn allow_destination(&self, path: &Path) {
        if let Ok(mut dirs) = self.destinations.lock() {
            dirs.insert(path.to_path_buf());
        }
    }

    pub fn is_item_allowed(&self, path: &Path) -> bool {
        self.items
            .lock()
            .map(|items| items.contains(path))
            .unwrap_or(false)
    }

    pub fn is_destination_allowed(&self, dir: &Path) -> bool {
        self.destinations
            .lock()
            .map(|dirs| dirs.contains(dir))
            .unwrap_or(false)
    }

    /// Keep the registry in sync after a successful rename.
    pub fn move_item(&self, from: &Path, to: &Path) {
        if let Ok(mut items) = self.items.lock() {
            items.remove(from);
            items.insert(to.to_path_buf());
        }
    }
}

/// A new name is valid when it is a single, non-empty path component.
pub fn is_plain_file_name(name: &str) -> bool {
    !name.is_empty()
        && name != "."
        && name != ".."
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains('\0')
}

/// A rename target must stay in the same folder as its source and only change
/// the final path component.
pub fn is_sibling_path(old_path: &Path, new_path: &Path) -> bool {
    match (old_path.parent(), new_path.parent(), new_path.file_name()) {
        (Some(old_parent), Some(new_parent), Some(name)) => {
            old_parent == new_parent && name.to_str().map(is_plain_file_name).unwrap_or(false)
        }
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sibling_paths_must_share_a_parent() {
        assert!(is_sibling_path(Path::new("/a/b/one.txt"), Path::new("/a/b/two.txt")));
        assert!(!is_sibling_path(Path::new("/a/b/one.txt"), Path::new("/a/c/two.txt")));
        assert!(!is_sibling_path(Path::new("/a/b/one.txt"), Path::new("/a/b/../two.txt")));
    }

    #[test]
    fn registry_tracks_renames() {
        let scope = FsScope::default();
        scope.allow_items([Path::new("/tmp/a.txt")]);
        assert!(scope.is_item_allowed(Path::new("/tmp/a.txt")));
        scope.move_item(Path::new("/tmp/a.txt"), Path::new("/tmp/b.txt"));
        assert!(!scope.is_item_allowed(Path::new("/tmp/a.txt")));
        assert!(scope.is_item_allowed(Path::new("/tmp/b.txt")));
    }
}
