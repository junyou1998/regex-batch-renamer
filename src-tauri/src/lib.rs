use flate2::read::GzDecoder;
use serde::Serialize;
use std::fs;
use std::io::Cursor;
#[cfg(target_os = "macos")]
use std::io::Write;
#[cfg(target_os = "macos")]
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::process::Command;
use tauri::WebviewWindow;
use tauri_plugin_updater::UpdaterExt;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileOperationRequest {
    old_path: String,
    new_path: String,
}

#[derive(Serialize)]
struct FileOperationResult {
    path: String,
    success: bool,
    error: Option<String>,
}

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
    option_env!("APP_RELEASE_CHANNEL")
        .unwrap_or("stable")
        .to_string()
}

fn runtime_version() -> String {
    option_env!("APP_VERSION")
        .unwrap_or(env!("CARGO_PKG_VERSION"))
        .to_string()
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

fn app_bundle_parent_writable(bundle_path: &PathBuf) -> Option<bool> {
    let parent = bundle_path.parent()?;
    let metadata = fs::metadata(parent).ok()?;
    Some(!metadata.permissions().readonly())
}

#[cfg(target_os = "macos")]
fn extract_update_to_staging(bytes: &[u8], parent_dir: &std::path::Path) -> Result<tempfile::TempDir, String> {
    let staging_dir = tempfile::Builder::new()
        .prefix("regex-batch-renamer-update-")
        .tempdir_in(parent_dir)
        .map_err(|error| error.to_string())?;

    let decoder = GzDecoder::new(Cursor::new(bytes));
    let mut archive = tar::Archive::new(decoder);

    for entry in archive.entries().map_err(|error| error.to_string())? {
        let mut entry = entry.map_err(|error| error.to_string())?;
        let collected_path: PathBuf = entry
            .path()
            .map_err(|error| error.to_string())?
            .iter()
            .skip(1)
            .collect();

        if collected_path.as_os_str().is_empty() {
            continue;
        }

        let extraction_path = staging_dir.path().join(&collected_path);
        if let Some(parent) = extraction_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        entry.unpack(&extraction_path).map_err(|error| error.to_string())?;
    }

    Ok(staging_dir)
}

#[cfg(target_os = "macos")]
fn spawn_macos_update_helper(
    app_bundle_path: &std::path::Path,
    staged_path: &std::path::Path,
) -> Result<(), String> {
    let parent_dir = app_bundle_path
        .parent()
        .ok_or("Failed to determine app parent directory")?;
    let backup_path = parent_dir.join(format!(
        ".{}-backup-{}",
        app_bundle_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("Regex Batch Renamer.app"),
        std::process::id()
    ));
    let script_path = parent_dir.join(format!(
        ".regex-batch-renamer-update-{}.sh",
        std::process::id()
    ));

    let script = format!(
        "#!/bin/sh\nset -eu\nPID='{pid}'\nAPP='{app}'\nSTAGED='{staged}'\nBACKUP='{backup}'\nfor _ in $(seq 1 120); do\n  if ! kill -0 \"$PID\" 2>/dev/null; then\n    break\n  fi\n  sleep 1\n done\nrm -rf \"$BACKUP\"\nif [ -d \"$APP\" ]; then\n  mv \"$APP\" \"$BACKUP\"\nfi\nmv \"$STAGED\" \"$APP\"\ntouch \"$APP\"\nopen -n \"$APP\"\nrm -rf \"$BACKUP\"\nrm -f \"$0\"\n",
        pid = std::process::id(),
        app = app_bundle_path.display(),
        staged = staged_path.display(),
        backup = backup_path.display()
    );

    let mut file = fs::File::create(&script_path).map_err(|error| error.to_string())?;
    file.write_all(script.as_bytes())
        .map_err(|error| error.to_string())?;
    let mut permissions = file.metadata().map_err(|error| error.to_string())?.permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&script_path, permissions).map_err(|error| error.to_string())?;

    Command::new("/bin/sh")
        .arg(&script_path)
        .spawn()
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
async fn install_app_update(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let updater = app.updater().map_err(|error| error.to_string())?;
        let update = updater
            .check()
            .await
            .map_err(|error| error.to_string())?
            .ok_or("No update available")?;

        let bytes = update
            .download(|_, _| {}, || {})
            .await
            .map_err(|error| error.to_string())?;

        let app_bundle_path = current_app_bundle_path()
            .ok_or("Failed to determine current app bundle path")?;
        let parent_dir = app_bundle_path
            .parent()
            .ok_or("Failed to determine app parent directory")?;
        let staging_dir = extract_update_to_staging(&bytes, parent_dir)?;
        let staged_path = staging_dir.keep();

        spawn_macos_update_helper(&app_bundle_path, &staged_path)?;

        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            std::thread::sleep(std::time::Duration::from_millis(300));
            app_handle.exit(0);
        });

        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let updater = app.updater().map_err(|error| error.to_string())?;
        let update = updater
            .check()
            .await
            .map_err(|error| error.to_string())?
            .ok_or("No update available")?;
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|error| error.to_string())?;
        Ok(())
    }
}

#[tauri::command]
fn runtime_info() -> RuntimeInfo {
    let app_bundle_path = current_app_bundle_path();

    RuntimeInfo {
        platform: platform_name(),
        runtime: "tauri".to_string(),
        channel: release_channel(),
        version: runtime_version(),
        app_bundle_path: app_bundle_path
            .as_ref()
            .map(|path| path.display().to_string()),
        app_bundle_parent_writable: app_bundle_path
            .as_ref()
            .and_then(app_bundle_parent_writable),
    }
}

#[tauri::command]
async fn rename_files(
    files: Vec<FileOperationRequest>,
    fail_on_exist: bool,
) -> Vec<FileOperationResult> {
    files
        .into_iter()
        .map(|file| {
            if file.old_path == file.new_path {
                return FileOperationResult {
                    path: file.old_path,
                    success: true,
                    error: None,
                };
            }

            if fail_on_exist && fs::metadata(&file.new_path).is_ok() {
                return FileOperationResult {
                    path: file.old_path,
                    success: false,
                    error: Some("FILE_EXISTS".to_string()),
                };
            }

            match fs::rename(&file.old_path, &file.new_path) {
                Ok(_) => FileOperationResult {
                    path: file.old_path,
                    success: true,
                    error: None,
                },
                Err(error) => FileOperationResult {
                    path: file.old_path,
                    success: false,
                    error: Some(error.kind().to_string()),
                },
            }
        })
        .collect()
}

#[tauri::command]
async fn copy_rename_files(files: Vec<FileOperationRequest>) -> Vec<FileOperationResult> {
    files
        .into_iter()
        .map(|file| match fs::copy(&file.old_path, &file.new_path) {
            Ok(_) => FileOperationResult {
                path: file.old_path,
                success: true,
                error: None,
            },
            Err(error) => FileOperationResult {
                path: file.old_path,
                success: false,
                error: Some(error.kind().to_string()),
            },
        })
        .collect()
}

#[tauri::command]
fn set_zoom_factor(window: WebviewWindow, factor: f64) -> Result<(), String> {
    window.set_zoom(factor).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            runtime_info,
            rename_files,
            copy_rename_files,
            set_zoom_factor,
            install_app_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
