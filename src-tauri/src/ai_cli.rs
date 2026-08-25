use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiCliStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub ready: bool,
    pub message: Option<String>,
    pub provider: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiRuleSnapshot {
    #[serde(rename = "type")]
    pub rule_type: String,
    pub params: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiChatRequest {
    pub prompt: String,
    pub history: Vec<AiChatMessage>,
    pub sample_filenames: Vec<String>,
    pub current_pipeline: Vec<AiRuleSnapshot>,
    pub process_filename_only: Option<bool>,
    pub provider: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiPipelineItem {
    #[serde(rename = "type")]
    pub rule_type: String,
    pub params: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub reply: String,
    pub explanation: Option<String>,
    pub pipeline: Vec<AiPipelineItem>,
}

fn strip_ansi_codes(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let mut in_escape = false;
    let mut in_csi = false;

    for ch in input.chars() {
        if in_escape {
            if ch == '[' {
                in_csi = true;
                in_escape = false;
            } else {
                in_escape = false;
            }
        } else if in_csi {
            if ch.is_ascii_alphabetic() || ch == '~' || ch == '@' {
                in_csi = false;
            }
        } else if ch == '\x1b' {
            in_escape = true;
        } else {
            result.push(ch);
        }
    }

    result
}

fn expand_home_dir(path_str: &str) -> Option<PathBuf> {
    if let Some(stripped) = path_str.strip_prefix("~/") {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .ok()?;
        Some(Path::new(&home).join(stripped))
    } else {
        Some(PathBuf::from(path_str))
    }
}

pub fn find_cli(binary_name: &str) -> Option<PathBuf> {
    // 1. Direct which / where check
    let which_cmd = if cfg!(target_os = "windows") { "where" } else { "which" };
    if let Ok(output) = Command::new(which_cmd).arg(binary_name).output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = stdout.lines().next() {
                let candidate = PathBuf::from(first_line.trim());
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    // 2. On macOS/Linux, query user login shell
    #[cfg(unix)]
    {
        if let Ok(shell) = std::env::var("SHELL") {
            if let Ok(output) = Command::new(shell).args(["-l", "-c", &format!("which {binary_name}")]).output() {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    if let Some(first_line) = stdout.lines().next() {
                        let candidate = PathBuf::from(first_line.trim());
                        if candidate.is_file() {
                            return Some(candidate);
                        }
                    }
                }
            }
        }
    }

    // 3. Known common binary installation paths
    #[allow(unused_mut)]
    let mut candidate_paths: Vec<String> = vec![
        format!("/opt/homebrew/bin/{binary_name}"),
        format!("/usr/local/bin/{binary_name}"),
        format!("/usr/bin/{binary_name}"),
        format!("~/.grok/bin/{binary_name}"),
        format!("~/.cargo/bin/{binary_name}"),
        format!("~/.npm-global/bin/{binary_name}"),
        format!("~/.local/bin/{binary_name}"),
        format!("~/.volta/bin/{binary_name}"),
        format!("~/.asdf/shims/{binary_name}"),
        format!("~/.bun/bin/{binary_name}"),
    ];

    #[cfg(target_os = "windows")]
    {
        candidate_paths.extend_from_slice(&[
            format!("~\\AppData\\Roaming\\npm\\{binary_name}.cmd"),
            format!("~\\AppData\\Local\\Programs\\{binary_name}\\{binary_name}.exe"),
            format!("~\\.cargo\\bin\\{binary_name}.exe"),
            format!("~\\.grok\\bin\\{binary_name}.exe"),
        ]);
    }

    for path_str in candidate_paths {
        if let Some(expanded) = expand_home_dir(&path_str) {
            if expanded.is_file() {
                return Some(expanded);
            }
        }
    }

    // 4. Glob check for NVM node versions on unix
    #[cfg(unix)]
    {
        if let Ok(home) = std::env::var("HOME") {
            let nvm_versions_dir = Path::new(&home).join(".nvm/versions/node");
            if let Ok(entries) = std::fs::read_dir(nvm_versions_dir) {
                for entry in entries.flatten() {
                    let node_bin = entry.path().join(format!("bin/{binary_name}"));
                    if node_bin.is_file() {
                        return Some(node_bin);
                    }
                }
            }
        }
    }

    None
}

pub fn check_status(provider: Option<&str>) -> AiCliStatus {
    let prov = provider.unwrap_or("claude").to_lowercase();
    let (binary_name, provider_name) = match prov.as_str() {
        "codex" => ("codex", "OpenAI Codex"),
        "grok" => ("grok", "xAI Grok"),
        _ => ("claude", "Claude Code"),
    };

    let cli_path = match find_cli(binary_name) {
        Some(p) => p,
        None => {
            return AiCliStatus {
                installed: false,
                path: None,
                version: None,
                ready: false,
                message: Some(format!("未偵測到 {provider_name} CLI。請先安裝並登入。")),
                provider: Some(prov),
            };
        }
    };

    let path_str = cli_path.display().to_string();

    let mut cmd = Command::new(&cli_path);
    if let Some(parent) = cli_path.parent() {
        let current_path = std::env::var("PATH").unwrap_or_default();
        let new_path = format!("{}:{}", parent.display(), current_path);
        cmd.env("PATH", new_path);
    }

    cmd.arg("--version");
    cmd.stdin(Stdio::null());

    match cmd.output() {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                AiCliStatus {
                    installed: true,
                    path: Some(path_str),
                    version: Some(stdout),
                    ready: true,
                    message: None,
                    provider: Some(prov),
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                AiCliStatus {
                    installed: true,
                    path: Some(path_str),
                    version: None,
                    ready: false,
                    message: Some(format!("執行版本檢查時發生錯誤: {stderr}")),
                    provider: Some(prov),
                }
            }
        }
        Err(e) => AiCliStatus {
            installed: true,
            path: Some(path_str),
            version: None,
            ready: false,
            message: Some(format!("無法執行 {provider_name} CLI: {e}")),
            provider: Some(prov),
        },
    }
}

pub fn build_prompt(request: &AiChatRequest) -> String {
    let mut prompt = String::new();

    prompt.push_str("You are an expert renaming assistant for the application 'Regex Batch Renamer'.\n");
    prompt.push_str("Your task is to analyze user requests, file patterns, and generate a complete, valid renaming rule pipeline.\n\n");

    prompt.push_str("### Rule Pipeline Specification:\n");
    prompt.push_str("- Each step in the pipeline must be an object: {\"type\": \"regex\", \"params\": { ... }}\n");
    prompt.push_str("- Supported parameters in 'params':\n");
    prompt.push_str("  - 'pattern': (string) Search regex or literal string.\n");
    prompt.push_str("  - 'replacement': (string) Replacement string. Supports standard regex capture groups ($1, $2, etc.) and special sequence variables:\n");
    prompt.push_str("    - '${n}' -> 1, 2, 3...\n");
    prompt.push_str("    - '${n:2}' -> 01, 02, 03... (width padding)\n");
    prompt.push_str("    - '${n:3:10}' -> 010, 011, 012... (width:startNum)\n");
    prompt.push_str("  - 'useRegex': (boolean) true for regex matching, false for literal text matching.\n\n");

    prompt.push_str("### Current Context:\n");
    let proc_mode = if request.process_filename_only.unwrap_or(true) {
        "Process Filename Only (Extension is preserved automatically)"
    } else {
        "Process Full Filename (Including extension)"
    };
    prompt.push_str(&format!("- Mode: {}\n", proc_mode));

    if !request.sample_filenames.is_empty() {
        prompt.push_str("- Sample Filenames currently loaded in the user's workspace:\n");
        for (i, name) in request.sample_filenames.iter().take(20).enumerate() {
            prompt.push_str(&format!("  {}. {}\n", i + 1, name));
        }
    } else {
        prompt.push_str("- Sample Filenames: (None loaded yet)\n");
    }

    if !request.current_pipeline.is_empty() {
        prompt.push_str("- Current Existing Pipeline in App:\n");
        if let Ok(json_rules) = serde_json::to_string_pretty(&request.current_pipeline) {
            prompt.push_str(&json_rules);
            prompt.push('\n');
        }
    } else {
        prompt.push_str("- Current Existing Pipeline in App: [] (Empty)\n");
    }

    if !request.history.is_empty() {
        prompt.push_str("\n### Previous Conversation:\n");
        for msg in &request.history {
            prompt.push_str(&format!("{}: {}\n", msg.role, msg.content));
        }
    }

    prompt.push_str(&format!("\n### User Request:\n{}\n\n", request.prompt));

    prompt.push_str("### Output Format & Language Instructions:\n");
    prompt.push_str("1. Language Consistency: You MUST reply in the SAME language used by the user in their request (e.g. if the user writes in English, reply in English; if in Traditional Chinese, reply in Traditional Chinese; if in Simplified Chinese, reply in Simplified Chinese; if in Japanese, reply in Japanese; etc.).\n");
    prompt.push_str("2. Output Format: You MUST provide your response strictly as a single JSON object inside a ```json ``` block with the following schema:\n");
    prompt.push_str("{\n");
    prompt.push_str("  \"reply\": \"(string) Friendly and clear explanation in the user's language describing what you analyzed and adjusted\",\n");
    prompt.push_str("  \"explanation\": \"(optional string) Technical breakdown in the user's language explaining the regex matching or substitution logic\",\n");
    prompt.push_str("  \"pipeline\": [\n");
    prompt.push_str("    {\n");
    prompt.push_str("      \"type\": \"regex\",\n");
    prompt.push_str("      \"params\": {\n");
    prompt.push_str("        \"pattern\": \"...\",\n");
    prompt.push_str("        \"replacement\": \"...\",\n");
    prompt.push_str("        \"useRegex\": true\n");
    prompt.push_str("      }\n");
    prompt.push_str("    }\n");
    prompt.push_str("  ]\n");
    prompt.push_str("}\n");

    prompt
}

pub fn extract_json_payload(raw: &str) -> Option<&str> {
    let clean = raw.trim();

    // 1. Look for ```json ... ``` block
    if let Some(start) = clean.find("```json") {
        let content = &clean[start + 7..];
        if let Some(end) = content.find("```") {
            return Some(content[..end].trim());
        }
    }

    // 2. Look for ``` ... ``` block
    if let Some(start) = clean.find("```") {
        let content = &clean[start + 3..];
        if let Some(end) = content.find("```") {
            return Some(content[..end].trim());
        }
    }

    // 3. Find outermost JSON object { ... }
    if let (Some(first_brace), Some(last_brace)) = (clean.find('{'), clean.rfind('}')) {
        if first_brace < last_brace {
            return Some(&clean[first_brace..=last_brace]);
        }
    }

    None
}

pub fn run_chat(request: AiChatRequest) -> Result<AiChatResponse, String> {
    let prov = request.provider.as_deref().unwrap_or("claude").to_lowercase();
    let (binary_name, provider_name) = match prov.as_str() {
        "codex" => ("codex", "OpenAI Codex"),
        "grok" => ("grok", "xAI Grok"),
        _ => ("claude", "Claude Code"),
    };

    let cli_path = find_cli(binary_name)
        .ok_or_else(|| format!("未偵測到 {provider_name} CLI，請確認已安裝並登入。"))?;

    let prompt = build_prompt(&request);

    let mut cmd = Command::new(&cli_path);
    if let Some(parent) = cli_path.parent() {
        let current_path = std::env::var("PATH").unwrap_or_default();
        let new_path = format!("{}:{}", parent.display(), current_path);
        cmd.env("PATH", new_path);
    }

    cmd.stdin(Stdio::null());

    if prov == "codex" {
        cmd.args(["exec", "--ephemeral", "--color", "never", "--skip-git-repo-check", &prompt]);
    } else {
        cmd.args(["-p", &prompt]);
    }

    let output = cmd.output().map_err(|e| format!("啟動 {provider_name} CLI 失敗: {e}"))?;

    let raw_stdout = String::from_utf8_lossy(&output.stdout);
    let raw_stderr = String::from_utf8_lossy(&output.stderr);
    let clean_stdout = strip_ansi_codes(&raw_stdout);

    if !output.status.success() && clean_stdout.trim().is_empty() {
        return Err(format!("{provider_name} CLI 執行錯誤: {}", raw_stderr.trim()));
    }

    let json_str = extract_json_payload(&clean_stdout)
        .ok_or_else(|| format!("無法從 {provider_name} CLI 輸出解析 JSON 回應:\n{}", clean_stdout.trim()))?;

    let response: AiChatResponse = serde_json::from_str(json_str)
        .map_err(|e| format!("JSON 結構反序列化失敗: {e}\n原始內容:\n{json_str}"))?;

    Ok(response)
}
