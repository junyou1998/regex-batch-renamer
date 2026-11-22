//! Safe batch rename / copy.
//!
//! Renames are planned up front and executed in two phases
//! (source -> unique temp name -> final name), so swaps (`a <-> b`), chains
//! (`1 -> 2, 2 -> 3`) and case-only renames (`photo.JPG -> photo.jpg` on a
//! case-insensitive disk) all work. If anything fails while moving files, every
//! step already taken is rolled back, so a folder is never left half renamed.
//!
//! Items that would collide (with a file on disk or with each other) are
//! rejected during planning and the rest of the batch still runs.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use crate::fs_scope::{is_plain_file_name, is_sibling_path, FsScope};

pub const FILE_EXISTS: &str = "FILE_EXISTS";
pub const DUPLICATE_TARGET: &str = "DUPLICATE_TARGET";
pub const NOT_ALLOWED: &str = "NOT_ALLOWED";
pub const INVALID_PATH: &str = "INVALID_PATH";
pub const NOT_FOUND: &str = "NOT_FOUND";
pub const ROLLED_BACK: &str = "ROLLED_BACK";
pub const IS_DIRECTORY: &str = "IS_DIRECTORY";
/// A folder whose contents are renamed in the same batch; rename it in a second pass.
pub const CONTAINS_BATCH_ITEMS: &str = "CONTAINS_BATCH_ITEMS";

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationRequest {
    pub old_path: String,
    pub new_path: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationResult {
    pub path: String,
    pub success: bool,
    pub error: Option<String>,
    /// The path actually written. Differs from the requested path when a copy
    /// was auto-suffixed to avoid a conflict.
    pub new_path: Option<String>,
}

impl FileOperationResult {
    fn ok(path: &str, new_path: &Path) -> Self {
        Self {
            path: path.to_string(),
            success: true,
            error: None,
            new_path: Some(new_path.display().to_string()),
        }
    }

    fn err(path: &str, code: impl Into<String>) -> Self {
        Self {
            path: path.to_string(),
            success: false,
            error: Some(code.into()),
            new_path: None,
        }
    }
}

fn filesystem_is_case_insensitive() -> bool {
    cfg!(any(target_os = "macos", target_os = "windows"))
}

/// Key used to detect two paths that the filesystem would treat as the same entry.
fn path_key(path: &Path) -> String {
    let raw = path.display().to_string();
    if filesystem_is_case_insensitive() {
        raw.to_lowercase()
    } else {
        raw
    }
}

fn exists_on_disk(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok()
}

/// True when `a` and `b` refer to the same filesystem entry (e.g. a case-only
/// rename on a case-insensitive disk).
fn same_entry(a: &Path, b: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        match (fs::symlink_metadata(a), fs::symlink_metadata(b)) {
            (Ok(ma), Ok(mb)) => ma.dev() == mb.dev() && ma.ino() == mb.ino(),
            _ => false,
        }
    }
    #[cfg(not(unix))]
    {
        a.parent() == b.parent()
            && a.file_name().map(|n| n.to_string_lossy().to_lowercase())
                == b.file_name().map(|n| n.to_string_lossy().to_lowercase())
    }
}

fn io_code(error: &std::io::Error) -> String {
    match error.kind() {
        std::io::ErrorKind::PermissionDenied => "PERMISSION_DENIED".to_string(),
        std::io::ErrorKind::NotFound => NOT_FOUND.to_string(),
        std::io::ErrorKind::AlreadyExists => FILE_EXISTS.to_string(),
        other => other.to_string(),
    }
}

fn temp_path_for(source: &Path, index: usize) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let parent = source.parent().unwrap_or_else(|| Path::new("."));
    parent.join(format!(".rbr-{}-{}-{}.tmp", std::process::id(), nanos, index))
}

struct PlannedRename {
    index: usize,
    old: PathBuf,
    new: PathBuf,
}

/// Rename a batch of files. Returns one result per request, in request order.
pub fn rename_batch(scope: &FsScope, files: Vec<FileOperationRequest>) -> Vec<FileOperationResult> {
    let mut results: Vec<Option<FileOperationResult>> = vec![None; files.len()];
    let mut planned: Vec<PlannedRename> = Vec::new();

    // 1. Validate each request on its own.
    for (index, file) in files.iter().enumerate() {
        let old = PathBuf::from(&file.old_path);
        let new = PathBuf::from(&file.new_path);

        if !scope.is_item_allowed(&old) {
            results[index] = Some(FileOperationResult::err(&file.old_path, NOT_ALLOWED));
            continue;
        }
        if old == new {
            results[index] = Some(FileOperationResult::ok(&file.old_path, &old));
            continue;
        }
        if !is_sibling_path(&old, &new) {
            results[index] = Some(FileOperationResult::err(&file.old_path, INVALID_PATH));
            continue;
        }
        if !exists_on_disk(&old) {
            results[index] = Some(FileOperationResult::err(&file.old_path, NOT_FOUND));
            continue;
        }
        planned.push(PlannedRename { index, old, new });
    }

    // 1b. A folder renamed together with items inside it would invalidate their
    //     paths. Keep the inner items and defer the folder to a second pass.
    let sources: Vec<PathBuf> = planned.iter().map(|item| item.old.clone()).collect();
    planned.retain(|item| {
        let is_ancestor = sources.iter().any(|other| other != &item.old && other.starts_with(&item.old));
        if is_ancestor {
            results[item.index] = Some(FileOperationResult::err(&files[item.index].old_path, CONTAINS_BATCH_ITEMS));
        }
        !is_ancestor
    });

    // 2. Reject targets that collide with each other.
    let mut target_count: HashMap<String, usize> = HashMap::new();
    for item in &planned {
        *target_count.entry(path_key(&item.new)).or_default() += 1;
    }
    planned.retain(|item| {
        if target_count.get(&path_key(&item.new)).copied().unwrap_or(0) > 1 {
            results[item.index] = Some(FileOperationResult::err(&files[item.index].old_path, DUPLICATE_TARGET));
            false
        } else {
            true
        }
    });

    // 3. Reject targets occupied by a file that is not itself moving away.
    //    Repeat until stable: dropping one item keeps its source in place, which
    //    may block another item's target.
    loop {
        let moving_sources: HashSet<String> = planned.iter().map(|item| path_key(&item.old)).collect();
        let before = planned.len();
        planned.retain(|item| {
            let occupied = exists_on_disk(&item.new)
                && !same_entry(&item.old, &item.new)
                && !moving_sources.contains(&path_key(&item.new));
            if occupied {
                results[item.index] = Some(FileOperationResult::err(&files[item.index].old_path, FILE_EXISTS));
            }
            !occupied
        });
        if planned.len() == before {
            break;
        }
    }

    // 4. Execute in two phases with full rollback on failure.
    if !planned.is_empty() {
        execute_two_phase(scope, &files, &planned, &mut results);
    }

    results
        .into_iter()
        .enumerate()
        .map(|(index, result)| result.unwrap_or_else(|| FileOperationResult::err(&files[index].old_path, "UNKNOWN")))
        .collect()
}

fn execute_two_phase(
    scope: &FsScope,
    files: &[FileOperationRequest],
    planned: &[PlannedRename],
    results: &mut [Option<FileOperationResult>],
) {
    let temps: Vec<PathBuf> = planned.iter().map(|item| temp_path_for(&item.old, item.index)).collect();

    // Phase 1: move every source to a unique temp name.
    for (pos, item) in planned.iter().enumerate() {
        if let Err(error) = fs::rename(&item.old, &temps[pos]) {
            for back in (0..pos).rev() {
                let _ = fs::rename(&temps[back], &planned[back].old);
            }
            mark_failed(files, planned, results, pos, io_code(&error));
            return;
        }
    }

    // Phase 2: move each temp to its final name, never overwriting.
    for (pos, item) in planned.iter().enumerate() {
        let failure = if exists_on_disk(&item.new) {
            Some(FILE_EXISTS.to_string())
        } else {
            fs::rename(&temps[pos], &item.new).err().map(|e| io_code(&e))
        };

        if let Some(code) = failure {
            for back in (0..pos).rev() {
                let _ = fs::rename(&planned[back].new, &temps[back]);
            }
            for back in (0..planned.len()).rev() {
                let _ = fs::rename(&temps[back], &planned[back].old);
            }
            mark_failed(files, planned, results, pos, code);
            return;
        }
    }

    for item in planned {
        scope.move_item(&item.old, &item.new);
        results[item.index] = Some(FileOperationResult::ok(&files[item.index].old_path, &item.new));
    }
}

fn mark_failed(
    files: &[FileOperationRequest],
    planned: &[PlannedRename],
    results: &mut [Option<FileOperationResult>],
    failed_pos: usize,
    code: String,
) {
    for (pos, item) in planned.iter().enumerate() {
        let item_code = if pos == failed_pos { code.clone() } else { ROLLED_BACK.to_string() };
        results[item.index] = Some(FileOperationResult::err(&files[item.index].old_path, item_code));
    }
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CopyConflictPolicy {
    /// Leave existing files alone and report FILE_EXISTS.
    Skip,
    /// Keep both: write `name (1).ext`, `name (2).ext`, ...
    Suffix,
}

fn suffixed_name(path: &Path, n: usize) -> PathBuf {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let file_name = path.file_name().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let (stem, ext) = match file_name.rfind('.') {
        Some(dot) if dot > 0 => (&file_name[..dot], &file_name[dot..]),
        _ => (file_name.as_str(), ""),
    };
    parent.join(format!("{stem} ({n}){ext}"))
}

/// Copy files into a user-picked destination folder without ever overwriting.
pub fn copy_batch(
    scope: &FsScope,
    files: Vec<FileOperationRequest>,
    policy: CopyConflictPolicy,
) -> Vec<FileOperationResult> {
    let mut claimed: HashSet<String> = HashSet::new();

    files
        .iter()
        .map(|file| {
            let old = PathBuf::from(&file.old_path);
            let requested = PathBuf::from(&file.new_path);

            if !scope.is_item_allowed(&old) {
                return FileOperationResult::err(&file.old_path, NOT_ALLOWED);
            }
            let valid_target = match (requested.parent(), requested.file_name().and_then(|n| n.to_str())) {
                (Some(dir), Some(name)) => is_plain_file_name(name) && scope.is_destination_allowed(dir),
                _ => false,
            };
            if !valid_target {
                return FileOperationResult::err(&file.old_path, INVALID_PATH);
            }
            match fs::metadata(&old) {
                Ok(meta) if meta.is_dir() => return FileOperationResult::err(&file.old_path, IS_DIRECTORY),
                Ok(_) => {}
                Err(error) => return FileOperationResult::err(&file.old_path, io_code(&error)),
            }

            let mut target = requested.clone();
            let mut attempt = 0usize;
            loop {
                let taken = claimed.contains(&path_key(&target)) || exists_on_disk(&target);
                if !taken {
                    break;
                }
                if policy == CopyConflictPolicy::Skip {
                    let code = if claimed.contains(&path_key(&target)) { DUPLICATE_TARGET } else { FILE_EXISTS };
                    return FileOperationResult::err(&file.old_path, code);
                }
                attempt += 1;
                if attempt > 9999 {
                    return FileOperationResult::err(&file.old_path, FILE_EXISTS);
                }
                target = suffixed_name(&requested, attempt);
            }

            // Reserve the name atomically so a file appearing in the meantime is
            // never clobbered, then copy contents and permissions over it.
            if let Err(error) = fs::OpenOptions::new().write(true).create_new(true).open(&target) {
                return FileOperationResult::err(&file.old_path, io_code(&error));
            }
            match fs::copy(&old, &target) {
                Ok(_) => {
                    claimed.insert(path_key(&target));
                    FileOperationResult::ok(&file.old_path, &target)
                }
                Err(error) => {
                    let _ = fs::remove_file(&target);
                    FileOperationResult::err(&file.old_path, io_code(&error))
                }
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TempDir(PathBuf);
    impl TempDir {
        fn new(label: &str) -> Self {
            let dir = std::env::temp_dir().join(format!(
                "rbr-test-{label}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
            ));
            fs::create_dir_all(&dir).unwrap();
            TempDir(dir)
        }
        fn file(&self, name: &str, content: &str) -> PathBuf {
            let path = self.0.join(name);
            fs::write(&path, content).unwrap();
            path
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn req(old: &Path, new: &Path) -> FileOperationRequest {
        FileOperationRequest { old_path: old.display().to_string(), new_path: new.display().to_string() }
    }

    #[test]
    fn swaps_two_files() {
        let dir = TempDir::new("swap");
        let a = dir.file("a.txt", "A");
        let b = dir.file("b.txt", "B");
        let scope = FsScope::default();
        scope.allow_items([&a, &b]);

        let results = rename_batch(&scope, vec![req(&a, &b), req(&b, &a)]);
        assert!(results.iter().all(|r| r.success), "{results:?}");
        assert_eq!(fs::read_to_string(&a).unwrap(), "B");
        assert_eq!(fs::read_to_string(&b).unwrap(), "A");
    }

    #[test]
    fn shifts_a_numbered_chain() {
        let dir = TempDir::new("chain");
        let one = dir.file("1.txt", "one");
        let two = dir.file("2.txt", "two");
        let three = dir.0.join("3.txt");
        let scope = FsScope::default();
        scope.allow_items([&one, &two]);

        let results = rename_batch(&scope, vec![req(&one, &two), req(&two, &three)]);
        assert!(results.iter().all(|r| r.success), "{results:?}");
        assert_eq!(fs::read_to_string(&two).unwrap(), "one");
        assert_eq!(fs::read_to_string(&three).unwrap(), "two");
    }

    #[test]
    fn refuses_to_overwrite_an_unrelated_file() {
        let dir = TempDir::new("exists");
        let a = dir.file("a.txt", "A");
        let other = dir.file("taken.txt", "keep me");
        let scope = FsScope::default();
        scope.allow_items([&a]);

        let results = rename_batch(&scope, vec![req(&a, &other)]);
        assert_eq!(results[0].error.as_deref(), Some(FILE_EXISTS));
        assert_eq!(fs::read_to_string(&other).unwrap(), "keep me");
        assert!(a.exists());
    }

    #[test]
    fn handles_case_only_rename() {
        let dir = TempDir::new("case");
        let upper = dir.file("Photo.JPG", "img");
        let lower = dir.0.join("Photo.jpg");
        let scope = FsScope::default();
        scope.allow_items([&upper]);

        let results = rename_batch(&scope, vec![req(&upper, &lower)]);
        assert!(results[0].success, "{results:?}");
        let names: Vec<String> = fs::read_dir(&dir.0).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().to_string()).collect();
        assert!(names.contains(&"Photo.jpg".to_string()), "{names:?}");
    }

    #[test]
    fn rejects_paths_outside_scope_and_folder_escapes() {
        let dir = TempDir::new("scope");
        let a = dir.file("a.txt", "A");
        let scope = FsScope::default();

        let results = rename_batch(&scope, vec![req(&a, &dir.0.join("b.txt"))]);
        assert_eq!(results[0].error.as_deref(), Some(NOT_ALLOWED));

        scope.allow_items([&a]);
        let escape = dir.0.join("sub").join("b.txt");
        let results = rename_batch(&scope, vec![req(&a, &escape)]);
        assert_eq!(results[0].error.as_deref(), Some(INVALID_PATH));
    }

    #[test]
    fn defers_a_folder_whose_contents_are_also_renamed() {
        let dir = TempDir::new("nested");
        let folder = dir.0.join("Trip");
        fs::create_dir_all(&folder).unwrap();
        let inner = folder.join("a.txt");
        fs::write(&inner, "A").unwrap();
        let scope = FsScope::default();
        scope.allow_items([&folder, &inner]);

        let results = rename_batch(&scope, vec![req(&folder, &dir.0.join("Trip 2026")), req(&inner, &folder.join("b.txt"))]);
        assert_eq!(results[0].error.as_deref(), Some(CONTAINS_BATCH_ITEMS));
        assert!(results[1].success, "{results:?}");
        assert!(folder.join("b.txt").exists());
    }

    #[test]
    fn copy_never_overwrites_and_can_keep_both() {
        let src_dir = TempDir::new("copy-src");
        let dst_dir = TempDir::new("copy-dst");
        let a = src_dir.file("a.txt", "new");
        let existing = dst_dir.file("a.txt", "old");
        let scope = FsScope::default();
        scope.allow_items([&a]);
        scope.allow_destination(&dst_dir.0);

        let skipped = copy_batch(&scope, vec![req(&a, &existing)], CopyConflictPolicy::Skip);
        assert_eq!(skipped[0].error.as_deref(), Some(FILE_EXISTS));
        assert_eq!(fs::read_to_string(&existing).unwrap(), "old");

        let kept = copy_batch(&scope, vec![req(&a, &existing)], CopyConflictPolicy::Suffix);
        assert!(kept[0].success);
        assert_eq!(fs::read_to_string(dst_dir.0.join("a (1).txt")).unwrap(), "new");
        assert_eq!(fs::read_to_string(&existing).unwrap(), "old");
    }
}
