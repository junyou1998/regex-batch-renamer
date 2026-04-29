use serde::Serialize;
use std::fs;
use tauri::WebviewWindow;

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

#[tauri::command]
fn runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        platform: platform_name(),
        runtime: "tauri".to_string(),
        channel: release_channel(),
        version: runtime_version(),
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
            set_zoom_factor
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
