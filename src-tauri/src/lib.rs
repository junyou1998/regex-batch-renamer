mod ai_api;
mod ai_cli;
mod ai_task;
mod file_ops;
mod fs_scope;
mod net;
mod secrets;

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_updater::UpdaterExt;

use file_ops::{CopyConflictPolicy, FileOperationRequest, FileOperationResult};
use fs_scope::FsScope;
use secrets::SecretStore;

/// Largest file a plugin may read in one call.
const MAX_PLUGIN_READ_BYTES: usize = 64 * 1024 * 1024;

#[derive(Serialize)]
struct RuntimeInfo {
    platform: String,
    runtime: String,
    channel: String,
    version: String,
    app_bundle_path: Option<String>,
    app_bundle_parent_writable: Option<bool>,
}

fn platform_name() -> String {
    match std::env::consts::OS {
        "macos" => "darwin".to_string(),
        "windows" => "win32".to_string(),
        other => other.to_string(),
    }
}

fn release_channel() -> String {
    option_env!("APP_RELEASE_CHANNEL").unwrap_or("stable").to_string()
}

fn runtime_version() -> String {
    option_env!("APP_VERSION").unwrap_or(env!("CARGO_PKG_VERSION")).to_string()
}

fn current_app_bundle_path() -> Option<PathBuf> {
    if std::env::consts::OS != "macos" {
        return None;
    }
    let executable = std::env::current_exe().ok()?;
    executable
        .ancestors()
        .find(|path| path.extension().and_then(|ext| ext.to_str()) == Some("app"))
        .map(|path| path.to_path_buf())
}

fn app_bundle_parent_writable(bundle_path: &Path) -> Option<bool> {
    let parent = bundle_path.parent()?;
    let metadata = fs::metadata(parent).ok()?;
    Some(!metadata.permissions().readonly())
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn is_supported_windows_update_asset(download_url: &str) -> bool {
    let normalized = download_url.to_ascii_lowercase();
    normalized.ends_with(".exe") || normalized.ends_with(".zip")
}

#[tauri::command]
async fn install_app_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|error| error.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "No update available".to_string())?;

    #[cfg(target_os = "windows")]
    {
        let download_url = update.download_url.as_str().to_string();
        if !is_supported_windows_update_asset(&download_url) {
            return Err(format!("Unsupported Windows updater asset: {download_url}"));
        }
    }

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;

    app.restart();
}

#[tauri::command]
fn runtime_info() -> RuntimeInfo {
    let app_bundle_path = current_app_bundle_path();
    RuntimeInfo {
        platform: platform_name(),
        runtime: "tauri".to_string(),
        channel: release_channel(),
        version: runtime_version(),
        app_bundle_path: app_bundle_path.as_ref().map(|path| path.display().to_string()),
        app_bundle_parent_writable: app_bundle_path.as_deref().and_then(app_bundle_parent_writable),
    }
}

// ---------------------------------------------------------------------------
// File selection: every path the webview can operate on comes through here or
// through drag-and-drop, and is recorded in the FsScope.
// ---------------------------------------------------------------------------

fn paths_to_strings(paths: &[PathBuf]) -> Vec<String> {
    paths.iter().map(|p| p.display().to_string()).collect()
}

#[tauri::command]
async fn select_files(app: tauri::AppHandle, scope: State<'_, FsScope>) -> Result<Vec<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_files(move |picked| {
        let _ = tx.send(picked);
    });
    let picked = rx.await.map_err(|e| e.to_string())?.unwrap_or_default();
    let paths: Vec<PathBuf> = picked.into_iter().filter_map(|p| p.into_path().ok()).collect();
    scope.allow_items(&paths);
    Ok(paths_to_strings(&paths))
}

#[derive(Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum FolderPurpose {
    /// Add the folder itself to the rename list.
    Item,
    /// Use the folder as a "Copy To" destination.
    Destination,
    /// Add the files directly inside the folder (no hidden files).
    Contents,
    /// Add the files inside the folder and all of its subfolders.
    ContentsRecursive,
}

/// Upper bound on files collected from one folder, so dropping a huge tree
/// can't freeze the app.
const MAX_FOLDER_FILES: usize = 10_000;

fn is_hidden(path: &Path) -> bool {
    path.file_name()
        .map(|n| n.to_string_lossy().starts_with('.'))
        .unwrap_or(false)
}

/// Visible files inside `dir` (skipping hidden entries and symlinks), sorted.
/// With `recursive`, subfolders are walked too.
fn visible_files_in(dir: &Path, recursive: bool) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut pending = vec![dir.to_path_buf()];
    while let Some(current) = pending.pop() {
        let Ok(entries) = fs::read_dir(&current) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(kind) = entry.file_type() else { continue };
            if is_hidden(&path) || kind.is_symlink() {
                continue;
            }
            if kind.is_file() {
                files.push(path);
                if files.len() >= MAX_FOLDER_FILES {
                    files.sort();
                    return files;
                }
            } else if kind.is_dir() && recursive {
                pending.push(path);
            }
        }
    }
    files.sort();
    files
}

/// Dropped items: files stay as they are, folders are replaced by the files
/// directly inside them (renaming folders themselves is an explicit menu choice).
fn expand_dropped(paths: &[PathBuf]) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for path in paths {
        if path.is_dir() {
            out.extend(visible_files_in(path, false));
        } else {
            out.push(path.clone());
        }
    }
    out
}

#[tauri::command]
async fn select_directory(
    app: tauri::AppHandle,
    scope: State<'_, FsScope>,
    purpose: FolderPurpose,
) -> Result<Option<Vec<String>>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |picked| {
        let _ = tx.send(picked);
    });
    let Some(path) = rx.await.map_err(|e| e.to_string())?.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let selected = match purpose {
        FolderPurpose::Item => {
            scope.allow_items([&path]);
            vec![path]
        }
        FolderPurpose::Destination => {
            scope.allow_destination(&path);
            vec![path]
        }
        FolderPurpose::Contents | FolderPurpose::ContentsRecursive => {
            let files = visible_files_in(&path, purpose == FolderPurpose::ContentsRecursive);
            scope.allow_items(&files);
            files
        }
    };
    Ok(Some(paths_to_strings(&selected)))
}

#[derive(Deserialize)]
struct SaveFilter {
    name: String,
    extensions: Vec<String>,
}

/// Show a save dialog and write the text. The webview never chooses the path.
#[tauri::command]
async fn save_text_file(
    app: tauri::AppHandle,
    content: String,
    default_path: Option<String>,
    filters: Option<Vec<SaveFilter>>,
) -> Result<Option<String>, String> {
    let mut builder = app.dialog().file();
    if let Some(name) = default_path.as_deref().and_then(|p| Path::new(p).file_name()).and_then(|n| n.to_str()) {
        builder = builder.set_file_name(name);
    }
    for filter in filters.unwrap_or_default() {
        let exts: Vec<&str> = filter.extensions.iter().map(String::as_str).collect();
        builder = builder.add_filter(filter.name, &exts);
    }
    let (tx, rx) = tokio::sync::oneshot::channel();
    builder.save_file(move |picked| {
        let _ = tx.send(picked);
    });
    let Some(path) = rx.await.map_err(|e| e.to_string())?.and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(Some(path.display().to_string()))
}

// ---------------------------------------------------------------------------
// Rename / copy
// ---------------------------------------------------------------------------

#[tauri::command]
async fn rename_files(scope: State<'_, FsScope>, files: Vec<FileOperationRequest>) -> Result<Vec<FileOperationResult>, String> {
    Ok(file_ops::rename_batch(&scope, files))
}

#[tauri::command]
async fn copy_rename_files(
    scope: State<'_, FsScope>,
    files: Vec<FileOperationRequest>,
    on_conflict: Option<CopyConflictPolicy>,
) -> Result<Vec<FileOperationResult>, String> {
    Ok(file_ops::copy_batch(&scope, files, on_conflict.unwrap_or(CopyConflictPolicy::Skip)))
}

// ---------------------------------------------------------------------------
// Plugin file access (scoped to loaded files)
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeFileMetadata {
    size: u64,
    created_at_ms: Option<u64>,
    modified_at_ms: Option<u64>,
    is_file: bool,
    is_dir: bool,
}

fn ensure_loaded(scope: &FsScope, path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    if scope.is_item_allowed(&path) {
        Ok(path)
    } else {
        Err(file_ops::NOT_ALLOWED.to_string())
    }
}

#[tauri::command]
async fn read_file_binary(
    scope: State<'_, FsScope>,
    path: String,
    max_bytes: Option<usize>,
) -> Result<tauri::ipc::Response, String> {
    let path = ensure_loaded(&scope, &path)?;
    let limit = max_bytes.unwrap_or(MAX_PLUGIN_READ_BYTES).min(MAX_PLUGIN_READ_BYTES);
    let file = fs::File::open(&path).map_err(|e| e.kind().to_string())?;
    let mut buffer = Vec::new();
    file.take(limit as u64).read_to_end(&mut buffer).map_err(|e| e.kind().to_string())?;
    Ok(tauri::ipc::Response::new(buffer))
}

#[tauri::command]
async fn get_file_metadata(scope: State<'_, FsScope>, path: String) -> Result<NativeFileMetadata, String> {
    let path = ensure_loaded(&scope, &path)?;
    let metadata = fs::metadata(&path).map_err(|e| e.kind().to_string())?;
    let to_ms = |t: std::io::Result<std::time::SystemTime>| {
        t.ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
    };
    Ok(NativeFileMetadata {
        size: metadata.len(),
        created_at_ms: to_ms(metadata.created()),
        modified_at_ms: to_ms(metadata.modified()),
        is_file: metadata.is_file(),
        is_dir: metadata.is_dir(),
    })
}

// ---------------------------------------------------------------------------
// Network (plugins + marketplace)
// ---------------------------------------------------------------------------

#[tauri::command]
async fn plugin_http_request(request: net::HttpProxyRequest) -> Result<net::HttpProxyResponse, String> {
    net::proxy_request(request).await
}

#[tauri::command]
async fn fetch_remote_text(url: String) -> Result<String, String> {
    let bytes = net::fetch_bytes(&url).await?;
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

#[tauri::command]
async fn fetch_remote_bytes(url: String) -> Result<tauri::ipc::Response, String> {
    Ok(tauri::ipc::Response::new(net::fetch_bytes(&url).await?))
}

// ---------------------------------------------------------------------------
// Window helpers
// ---------------------------------------------------------------------------

#[tauri::command]
fn set_zoom_factor(window: WebviewWindow, factor: f64) -> Result<(), String> {
    window.set_zoom(factor).map_err(|error| error.to_string())
}

#[tauri::command]
fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}

/// DevTools are only available in debug builds.
#[tauri::command]
fn open_devtools(_window: WebviewWindow) {
    #[cfg(debug_assertions)]
    _window.open_devtools();
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

#[tauri::command]
async fn check_ai_cli_status(provider: Option<String>) -> ai_cli::AiCliStatus {
    tauri::async_runtime::spawn_blocking(move || ai_cli::check_status(provider.as_deref()))
        .await
        .unwrap_or_else(|e| ai_cli::AiCliStatus {
            installed: false,
            path: None,
            version: None,
            ready: false,
            message: Some(e.to_string()),
            provider: None,
        })
}

#[tauri::command]
async fn run_ai_chat(request: ai_cli::AiChatRequest) -> Result<ai_cli::AiChatResponse, String> {
    ai_cli::run_chat(request).await
}

#[tauri::command]
async fn test_ai_api_connection(
    secrets: State<'_, SecretStore>,
    profile: ai_api::AiApiProfile,
) -> Result<ai_api::AiApiTestResult, String> {
    let saved = secrets.get(&profile.id);
    Ok(ai_api::test_connection(&profile, saved).await)
}

#[tauri::command]
async fn list_ai_models(secrets: State<'_, SecretStore>, profile: ai_api::AiApiProfile) -> Result<Vec<String>, String> {
    let saved = secrets.get(&profile.id);
    ai_api::list_models(&profile, saved).await
}

#[tauri::command]
async fn run_ai_api_chat(
    secrets: State<'_, SecretStore>,
    request: ai_cli::AiChatRequest,
    profile: ai_api::AiApiProfile,
) -> Result<ai_cli::AiChatResponse, String> {
    let saved = secrets.get(&profile.id);
    ai_api::run_api_chat(request, profile, saved).await
}

#[tauri::command]
fn cancel_ai_chat(task_id: String) -> bool {
    ai_task::cancel_task(&task_id)
}

#[tauri::command]
fn set_ai_secret(secrets: State<'_, SecretStore>, profile_id: String, api_key: String) -> Result<(), String> {
    secrets.set(&profile_id, &api_key)
}

#[tauri::command]
fn delete_ai_secret(secrets: State<'_, SecretStore>, profile_id: String) -> Result<(), String> {
    secrets.delete(&profile_id)
}

/// Which profiles have a saved key. Keys themselves never leave Rust.
#[tauri::command]
fn list_ai_secret_ids(secrets: State<'_, SecretStore>) -> Vec<String> {
    secrets.profile_ids()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(FsScope::default())
        .setup(|app| {
            let config_dir = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("regex-batch-renamer"));
            app.manage(SecretStore::new(config_dir));
            Ok(())
        })
        .on_window_event(|window, event| {
            // Register dropped paths before the frontend sees them, then hand
            // them over through our own event.
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let expanded = expand_dropped(paths);
                window.state::<FsScope>().allow_items(&expanded);
                let _ = window.emit("app://files-dropped", paths_to_strings(&expanded));
            }
        })
        .invoke_handler(tauri::generate_handler![
            runtime_info,
            select_files,
            select_directory,
            save_text_file,
            rename_files,
            copy_rename_files,
            read_file_binary,
            get_file_metadata,
            plugin_http_request,
            fetch_remote_text,
            fetch_remote_bytes,
            set_zoom_factor,
            exit_app,
            open_devtools,
            install_app_update,
            check_ai_cli_status,
            run_ai_chat,
            test_ai_api_connection,
            list_ai_models,
            run_ai_api_chat,
            cancel_ai_chat,
            set_ai_secret,
            delete_ai_secret,
            list_ai_secret_ids
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{expand_dropped, is_supported_windows_update_asset, visible_files_in};
    use std::fs;

    #[test]
    fn folders_expand_to_visible_files() {
        let root = std::env::temp_dir().join(format!("rbr-expand-{}", std::process::id()));
        let sub = root.join("sub");
        fs::create_dir_all(&sub).unwrap();
        fs::write(root.join("a.txt"), "").unwrap();
        fs::write(root.join(".hidden"), "").unwrap();
        fs::write(sub.join("b.txt"), "").unwrap();

        assert_eq!(visible_files_in(&root, false), vec![root.join("a.txt")]);
        assert_eq!(visible_files_in(&root, true), vec![root.join("a.txt"), sub.join("b.txt")]);
        let loose = root.join("loose.txt");
        fs::write(&loose, "").unwrap();
        assert_eq!(expand_dropped(&[sub.clone(), loose.clone()]), vec![sub.join("b.txt"), loose]);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn accepts_windows_nsis_setup_exe_assets() {
        assert!(is_supported_windows_update_asset(
            "https://example.com/Renamix_0.5.1_x64-setup.exe"
        ));
    }

    #[test]
    fn rejects_non_windows_update_assets() {
        assert!(!is_supported_windows_update_asset(
            "https://example.com/Renamix_x64.app.tar.gz"
        ));
    }
}
