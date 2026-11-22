//! API key storage.
//!
//! Keys live in a file inside the app's config directory that only the Rust
//! side reads (permissions 0600 on Unix). The webview never gets a key back,
//! so plugins or injected scripts cannot read them from localStorage.
//!
//! The OS keychain was considered, but unsigned macOS builds trigger a keychain
//! access prompt after every update, which is worse UX than a private file
//! (the same approach CLI tools like `gh` and `codex` use).

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct SecretStore {
    path: PathBuf,
    cache: Mutex<Option<HashMap<String, String>>>,
}

impl SecretStore {
    pub fn new(config_dir: PathBuf) -> Self {
        Self {
            path: config_dir.join("ai-secrets.json"),
            cache: Mutex::new(None),
        }
    }

    fn load(&self) -> HashMap<String, String> {
        fs::read_to_string(&self.path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    fn with_map<T>(&self, f: impl FnOnce(&mut HashMap<String, String>) -> T) -> T {
        let mut guard = self.cache.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        if guard.is_none() {
            *guard = Some(self.load());
        }
        f(guard.as_mut().expect("cache initialised above"))
    }

    fn persist(&self, map: &HashMap<String, String>) -> Result<(), String> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string(map).map_err(|e| e.to_string())?;
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, json).map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&tmp, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
        }
        fs::rename(&tmp, &self.path).map_err(|e| e.to_string())
    }

    pub fn get(&self, profile_id: &str) -> Option<String> {
        self.with_map(|map| map.get(profile_id).cloned())
    }

    pub fn set(&self, profile_id: &str, key: &str) -> Result<(), String> {
        self.with_map(|map| {
            if key.trim().is_empty() {
                map.remove(profile_id);
            } else {
                map.insert(profile_id.to_string(), key.trim().to_string());
            }
            self.persist(map)
        })
    }

    pub fn delete(&self, profile_id: &str) -> Result<(), String> {
        self.with_map(|map| {
            map.remove(profile_id);
            self.persist(map)
        })
    }

    pub fn profile_ids(&self) -> Vec<String> {
        self.with_map(|map| map.keys().cloned().collect())
    }
}
