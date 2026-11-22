use crate::ai_cli::{build_prompt, err, parse_model_output, AiChatRequest, AiChatResponse, AiUsage};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

pub const USER_AGENT: &str = concat!("Renamix/", env!("CARGO_PKG_VERSION"));

pub const DEFAULT_ANTHROPIC_MODEL: &str = "claude-opus-5-5";
pub const DEFAULT_OPENAI_MODEL: &str = "gpt-5.5";
pub const DEFAULT_GEMINI_MODEL: &str = "gemini-flash-latest";
pub const DEFAULT_OLLAMA_MODEL: &str = "llama3.3";

const ANTHROPIC_ENDPOINT: &str = "https://api.anthropic.com/v1";
const OPENAI_ENDPOINT: &str = "https://api.openai.com/v1";
const GEMINI_ENDPOINT: &str = "https://generativelanguage.googleapis.com";
const OLLAMA_ENDPOINT: &str = "http://localhost:11434";

/// Models that support Anthropic's server-side refusal fallback.
const ANTHROPIC_FALLBACK_MODELS: &[&str] = &[
    "claude-fable-5-2",
    "claude-fable-5-1",
    "claude-opus-5-5",
    "claude-opus-5",
    "claude-sonnet-5-5",
];

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiApiProfile {
    pub id: String,
    #[serde(default)]
    pub name: String,
    pub provider: String,
    /// Only set while the user is editing an unsaved key (e.g. "Test connection").
    /// Saved keys are read from the secret store on the Rust side.
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub endpoint: String,
    #[serde(default)]
    pub model: String,
    pub temperature: Option<f32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiApiTestResult {
    pub success: bool,
    /// `CODE` or `CODE|detail`, translated by the frontend.
    pub message: String,
    #[serde(default)]
    pub models: Vec<String>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Provider {
    Anthropic,
    OpenAi,
    Gemini,
    Ollama,
}

impl Provider {
    fn from_profile(profile: &AiApiProfile) -> Self {
        match profile.provider.trim().to_lowercase().as_str() {
            "anthropic" | "claude" => Provider::Anthropic,
            "openai" | "custom" => Provider::OpenAi,
            "ollama" => Provider::Ollama,
            _ => Provider::Gemini,
        }
    }

    fn default_endpoint(self) -> &'static str {
        match self {
            Provider::Anthropic => ANTHROPIC_ENDPOINT,
            Provider::OpenAi => OPENAI_ENDPOINT,
            Provider::Gemini => GEMINI_ENDPOINT,
            Provider::Ollama => OLLAMA_ENDPOINT,
        }
    }

    fn default_model(self) -> &'static str {
        match self {
            Provider::Anthropic => DEFAULT_ANTHROPIC_MODEL,
            Provider::OpenAi => DEFAULT_OPENAI_MODEL,
            Provider::Gemini => DEFAULT_GEMINI_MODEL,
            Provider::Ollama => DEFAULT_OLLAMA_MODEL,
        }
    }

    fn requires_key(self) -> bool {
        self != Provider::Ollama
    }
}

struct Resolved {
    provider: Provider,
    endpoint: String,
    model: String,
    key: String,
    temperature: Option<f32>,
}

fn resolve(profile: &AiApiProfile, saved_key: Option<String>) -> Result<Resolved, String> {
    let provider = Provider::from_profile(profile);
    let typed = profile.api_key.trim();
    let key = if typed.is_empty() { saved_key.unwrap_or_default() } else { typed.to_string() };
    if provider.requires_key() && key.trim().is_empty() {
        return Err(err::MISSING_API_KEY.into());
    }
    let endpoint = match profile.endpoint.trim().trim_end_matches('/') {
        "" => provider.default_endpoint().to_string(),
        custom => custom.to_string(),
    };
    let model = match profile.model.trim() {
        "" => provider.default_model().to_string(),
        m => m.to_string(),
    };
    Ok(Resolved { provider, endpoint, model, key: key.trim().to_string(), temperature: profile.temperature })
}

fn http_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| err::with(err::NETWORK, e))
}

/// reqwest errors embed the request URL; strip it so nothing secret leaks.
fn network_error(e: reqwest::Error) -> String {
    if e.is_timeout() {
        err::TIMEOUT.to_string()
    } else {
        err::with(err::NETWORK, e.without_url())
    }
}

fn api_error_detail(body: &str) -> String {
    serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| {
            v.pointer("/error/message")
                .or_else(|| v.get("error"))
                .and_then(|m| m.as_str().map(str::to_string))
        })
        .unwrap_or_else(|| body.to_string())
}

fn with_auth(builder: reqwest::RequestBuilder, r: &Resolved) -> reqwest::RequestBuilder {
    match r.provider {
        Provider::Anthropic => builder.header("x-api-key", &r.key).header("anthropic-version", "2023-06-01"),
        Provider::Gemini => builder.header("x-goog-api-key", &r.key),
        Provider::OpenAi | Provider::Ollama => {
            if r.key.is_empty() {
                builder
            } else {
                builder.bearer_auth(&r.key)
            }
        }
    }
}

fn ollama_root(endpoint: &str) -> &str {
    endpoint.strip_suffix("/v1").unwrap_or(endpoint)
}

/// List the models this key can use, newest first where the provider sorts them.
async fn fetch_models(r: &Resolved) -> Result<Vec<String>, String> {
    let client = http_client(20)?;
    let url = match r.provider {
        Provider::Anthropic => format!("{}/models?limit=100", r.endpoint),
        Provider::OpenAi => format!("{}/models", r.endpoint),
        Provider::Gemini => format!("{}/v1beta/models?pageSize=200", r.endpoint),
        Provider::Ollama => format!("{}/api/tags", ollama_root(&r.endpoint)),
    };
    let response = with_auth(client.get(&url), r).send().await.map_err(network_error)?;
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(err::with(err::HTTP, format!("{} {}", status.as_u16(), api_error_detail(&body))));
    }
    let parsed: Value = serde_json::from_str(&body).map_err(|e| err::with(err::PARSE, e))?;

    let mut models: Vec<String> = match r.provider {
        Provider::Anthropic => collect_strings(&parsed, "data", "id"),
        Provider::OpenAi => collect_strings(&parsed, "data", "id"),
        Provider::Gemini => parsed
            .get("models")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter(|m| {
                        m.get("supportedGenerationMethods")
                            .and_then(Value::as_array)
                            .map(|methods| methods.iter().any(|x| x.as_str() == Some("generateContent")))
                            .unwrap_or(false)
                    })
                    .filter_map(|m| m.get("name").and_then(Value::as_str))
                    .map(|name| name.trim_start_matches("models/").to_string())
                    .collect()
            })
            .unwrap_or_default(),
        Provider::Ollama => collect_strings(&parsed, "models", "name"),
    };
    // Keep only models that can write a text reply; drop speech, image, video,
    // embedding and other special-purpose variants.
    models.retain(|id| is_text_chat_model(id));
    models.sort();
    models.dedup();
    Ok(models)
}

const NON_CHAT_MARKERS: &[&str] = &[
    "embedding", "embed", "whisper", "tts", "dall-e", "image", "audio", "realtime", "moderation",
    "transcribe", "search", "omni", "banana", "veo", "imagen", "aqa", "customtools", "live",
    "robotics", "computer-use", "codex-mini",
];

fn is_text_chat_model(id: &str) -> bool {
    let lower = id.to_lowercase();
    !NON_CHAT_MARKERS.iter().any(|marker| lower.contains(marker))
}

fn collect_strings(value: &Value, array_key: &str, field: &str) -> Vec<String> {
    value
        .get(array_key)
        .and_then(Value::as_array)
        .map(|arr| arr.iter().filter_map(|m| m.get(field).and_then(Value::as_str).map(str::to_string)).collect())
        .unwrap_or_default()
}

fn model_is_available(models: &[String], wanted: &str) -> Option<String> {
    if models.iter().any(|m| m == wanted) {
        return Some(wanted.to_string());
    }
    // Ollama tags: `llama3.3` matches `llama3.3:latest` / `llama3.3:70b`.
    let tagged = format!("{wanted}:");
    models.iter().find(|m| m.starts_with(&tagged)).cloned()
}

pub async fn list_models(profile: &AiApiProfile, saved_key: Option<String>) -> Result<Vec<String>, String> {
    let resolved = resolve(profile, saved_key)?;
    fetch_models(&resolved).await
}

pub async fn test_connection(profile: &AiApiProfile, saved_key: Option<String>) -> AiApiTestResult {
    let resolved = match resolve(profile, saved_key) {
        Ok(r) => r,
        Err(message) => return AiApiTestResult { success: false, message, models: vec![] },
    };
    match fetch_models(&resolved).await {
        Ok(models) if models.is_empty() => AiApiTestResult {
            success: resolved.provider != Provider::Ollama,
            message: if resolved.provider == Provider::Ollama {
                err::with("AI_TEST_NO_MODELS", &resolved.model)
            } else {
                err::with("AI_TEST_OK", &resolved.model)
            },
            models,
        },
        Ok(models) => match model_is_available(&models, &resolved.model) {
            Some(found) => AiApiTestResult { success: true, message: err::with("AI_TEST_OK", found), models },
            None => AiApiTestResult {
                success: false,
                message: err::with("AI_TEST_MODEL_MISSING", &resolved.model),
                models,
            },
        },
        Err(message) => AiApiTestResult { success: false, message, models: vec![] },
    }
}

pub async fn run_api_chat(
    request: AiChatRequest,
    profile: AiApiProfile,
    saved_key: Option<String>,
) -> Result<AiChatResponse, String> {
    let task_id = request.task_id.clone();
    let mut cancel_rx = task_id.as_deref().map(crate::ai_task::register_task);

    let result = match resolve(&profile, saved_key) {
        Ok(resolved) => {
            let send = send_chat(&request, resolved);
            match cancel_rx.as_mut() {
                Some(rx) => tokio::select! {
                    res = send => res,
                    _ = rx => Err(err::CANCELLED.into()),
                },
                None => send.await,
            }
        }
        Err(e) => Err(e),
    };

    if let Some(ref tid) = task_id {
        crate::ai_task::finish_task(tid);
    }
    result
}

/// Statuses worth retrying: rate limits and temporary server overload
/// (Anthropic uses 529 for "overloaded").
fn is_retryable(status: u16) -> bool {
    matches!(status, 429 | 500 | 502 | 503 | 504 | 529)
}

/// Delay before retry `attempt` (1-based), honouring a short Retry-After.
fn retry_delay(attempt: u32, retry_after: Option<&str>) -> Duration {
    let suggested = retry_after.and_then(|v| v.trim().parse::<u64>().ok()).map(|secs| secs.min(15));
    Duration::from_secs(suggested.unwrap_or(match attempt {
        1 => 2,
        _ => 5,
    }))
}

const MAX_ATTEMPTS: u32 = 3;
/// Cloud APIs: give up on one attempt after this long...
const CLOUD_ATTEMPT_TIMEOUT_SECS: u64 = 60;
/// ...and never start a retry once this much time has passed overall.
const CLOUD_RETRY_BUDGET: Duration = Duration::from_secs(100);

async fn post_json(r: &Resolved, url: &str, payload: &Value, extra: &[(&str, &str)]) -> Result<Value, String> {
    let client = http_client(if r.provider == Provider::Ollama { 300 } else { CLOUD_ATTEMPT_TIMEOUT_SECS })?;
    let started = std::time::Instant::now();
    let mut attempt = 0;
    loop {
        attempt += 1;
        let mut builder = with_auth(client.post(url), r).json(payload);
        for (k, v) in extra {
            builder = builder.header(*k, *v);
        }
        let response = builder.send().await.map_err(network_error)?;
        let status = response.status();
        let retry_after = response
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        let body = response.text().await.unwrap_or_default();
        if status.is_success() {
            return serde_json::from_str(&body).map_err(|e| err::with(err::PARSE, e));
        }

        let code = status.as_u16();
        let detail = api_error_detail(&body);
        let delay = retry_delay(attempt, retry_after.as_deref());
        let within_budget = started.elapsed() + delay < CLOUD_RETRY_BUDGET;
        if is_retryable(code) && attempt < MAX_ATTEMPTS && within_budget {
            // Cancellation still works: the caller races this future against the cancel signal.
            tokio::time::sleep(delay).await;
            continue;
        }
        if code == 404 && detail.to_lowercase().contains("model") {
            return Err(err::with(err::MODEL_NOT_FOUND, format!("{}: {detail}", r.model)));
        }
        if code == 429 {
            return Err(err::with(err::RATE_LIMITED, format!("{} — {detail}", r.model)));
        }
        if is_retryable(code) {
            return Err(err::with(err::OVERLOADED, format!("{} — {code} {detail}", r.model)));
        }
        return Err(err::with(err::HTTP, format!("{code} {detail}")));
    }
}

fn finish(raw_text: &str, usage: Option<AiUsage>, model: Option<String>) -> Result<AiChatResponse, String> {
    let mut response = parse_model_output(raw_text)?;
    response.usage = usage;
    response.model = model;
    Ok(response)
}

async fn send_chat(request: &AiChatRequest, r: Resolved) -> Result<AiChatResponse, String> {
    let prompt = build_prompt(request);
    match r.provider {
        Provider::Anthropic => anthropic_chat(&prompt, &r).await,
        Provider::OpenAi => openai_chat(&prompt, &r).await,
        Provider::Gemini => gemini_chat(&prompt, &r).await,
        Provider::Ollama => ollama_chat(&prompt, &r).await,
    }
}

async fn anthropic_chat(prompt: &str, r: &Resolved) -> Result<AiChatResponse, String> {
    let url = if r.endpoint.ends_with("/messages") { r.endpoint.clone() } else { format!("{}/messages", r.endpoint) };

    // Current Claude models reject sampling parameters (temperature/top_p/top_k),
    // so none are sent. Thinking is left at the model default.
    let mut payload = json!({
        "model": r.model,
        "max_tokens": 16000,
        "messages": [{ "role": "user", "content": prompt }],
    });

    // Server-side refusal fallback, only against the official endpoint (proxies
    // and gateways may not accept the beta) and only for models that support it.
    let mut extra: Vec<(&str, &str)> = Vec::new();
    if r.endpoint == ANTHROPIC_ENDPOINT && ANTHROPIC_FALLBACK_MODELS.contains(&r.model.as_str()) {
        payload["fallbacks"] = json!("default");
        extra.push(("anthropic-beta", "server-side-fallback-2026-07-01"));
    }

    let parsed = post_json(r, &url, &payload, &extra).await?;

    if parsed.get("stop_reason").and_then(Value::as_str) == Some("refusal") {
        let detail = parsed
            .pointer("/stop_details/explanation")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        return Err(err::with(err::REFUSED, detail));
    }

    // Content is a list of typed blocks (thinking, text, fallback, ...); only
    // text blocks carry the answer.
    let text: String = parsed
        .get("content")
        .and_then(Value::as_array)
        .map(|blocks| {
            blocks
                .iter()
                .filter(|b| b.get("type").and_then(Value::as_str) == Some("text"))
                .filter_map(|b| b.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    if text.trim().is_empty() {
        return Err(err::with(err::PARSE, "empty response"));
    }

    let usage = AiUsage {
        input_tokens: parsed.pointer("/usage/input_tokens").and_then(Value::as_u64),
        output_tokens: parsed.pointer("/usage/output_tokens").and_then(Value::as_u64),
    };
    let model = parsed.get("model").and_then(Value::as_str).map(str::to_string).or(Some(r.model.clone()));
    finish(&text, Some(usage), model)
}

async fn openai_chat(prompt: &str, r: &Resolved) -> Result<AiChatResponse, String> {
    let url = if r.endpoint.ends_with("/chat/completions") {
        r.endpoint.clone()
    } else {
        format!("{}/chat/completions", r.endpoint)
    };
    // Reasoning models reject non-default temperature; only send it when the
    // user set one explicitly for an OpenAI-compatible endpoint.
    let mut payload = json!({
        "model": r.model,
        "messages": [{ "role": "user", "content": prompt }],
        "response_format": { "type": "json_object" },
    });
    if r.endpoint != OPENAI_ENDPOINT {
        if let Some(t) = r.temperature {
            payload["temperature"] = json!(t);
        }
    }
    let parsed = post_json(r, &url, &payload, &[]).await?;
    let text = parsed
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .ok_or_else(|| err::with(err::PARSE, "missing choices[0].message.content"))?;
    let usage = AiUsage {
        input_tokens: parsed.pointer("/usage/prompt_tokens").and_then(Value::as_u64),
        output_tokens: parsed.pointer("/usage/completion_tokens").and_then(Value::as_u64),
    };
    let model = parsed.get("model").and_then(Value::as_str).map(str::to_string).or(Some(r.model.clone()));
    finish(text, Some(usage), model)
}

async fn gemini_chat(prompt: &str, r: &Resolved) -> Result<AiChatResponse, String> {
    let url = format!("{}/v1beta/models/{}:generateContent", r.endpoint, r.model);
    let mut generation_config = json!({ "responseMimeType": "application/json" });
    if let Some(t) = r.temperature {
        generation_config["temperature"] = json!(t);
    }
    let payload = json!({
        "contents": [{ "role": "user", "parts": [{ "text": prompt }] }],
        "generationConfig": generation_config,
    });
    let parsed = post_json(r, &url, &payload, &[]).await?;
    let text: String = parsed
        .pointer("/candidates/0/content/parts")
        .and_then(Value::as_array)
        .map(|parts| {
            parts
                .iter()
                .filter(|p| p.get("thought").and_then(Value::as_bool) != Some(true))
                .filter_map(|p| p.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default();
    if text.trim().is_empty() {
        let reason = parsed.pointer("/candidates/0/finishReason").and_then(Value::as_str).unwrap_or("empty response");
        return Err(err::with(if reason == "SAFETY" { err::REFUSED } else { err::PARSE }, reason));
    }
    let usage = AiUsage {
        input_tokens: parsed.pointer("/usageMetadata/promptTokenCount").and_then(Value::as_u64),
        output_tokens: parsed.pointer("/usageMetadata/candidatesTokenCount").and_then(Value::as_u64),
    };
    finish(&text, Some(usage), Some(r.model.clone()))
}

async fn ollama_chat(prompt: &str, r: &Resolved) -> Result<AiChatResponse, String> {
    // Resolve `llama3.3` to an installed tag such as `llama3.3:latest`.
    let model = match fetch_models(r).await {
        Ok(models) => model_is_available(&models, &r.model)
            .or_else(|| if models.len() == 1 { models.first().cloned() } else { None })
            .unwrap_or_else(|| r.model.clone()),
        Err(_) => r.model.clone(),
    };
    let temperature = r.temperature.unwrap_or(0.2);

    let (url, payload, is_v1) = if r.endpoint.ends_with("/v1") {
        (
            format!("{}/chat/completions", r.endpoint),
            json!({ "model": model, "messages": [{ "role": "user", "content": prompt }], "temperature": temperature }),
            true,
        )
    } else {
        (
            format!("{}/api/chat", r.endpoint),
            json!({
                "model": model,
                "messages": [{ "role": "user", "content": prompt }],
                "stream": false,
                "format": "json",
                "options": { "temperature": temperature },
            }),
            false,
        )
    };
    let parsed = post_json(r, &url, &payload, &[]).await?;
    let pointer = if is_v1 { "/choices/0/message/content" } else { "/message/content" };
    let text = parsed
        .pointer(pointer)
        .and_then(Value::as_str)
        .ok_or_else(|| err::with(err::PARSE, "missing message content"))?;
    let usage = AiUsage {
        input_tokens: parsed.get("prompt_eval_count").and_then(Value::as_u64),
        output_tokens: parsed.get("eval_count").and_then(Value::as_u64),
    };
    finish(text, Some(usage), Some(model))
}

#[cfg(test)]
mod tests {
    use super::{is_retryable, is_text_chat_model, retry_delay};
    use std::time::Duration;

    #[test]
    fn retries_only_temporary_failures() {
        for code in [429, 500, 502, 503, 504, 529] {
            assert!(is_retryable(code), "{code}");
        }
        for code in [400, 401, 403, 404] {
            assert!(!is_retryable(code), "{code}");
        }
        assert_eq!(retry_delay(1, None), Duration::from_secs(2));
        assert_eq!(retry_delay(2, Some("120")), Duration::from_secs(15));
    }

    #[test]
    fn filters_special_purpose_models() {
        for keep in ["gemini-3.6-flash", "gemini-flash-latest", "gemma-4-31b-it", "claude-opus-5-5", "gpt-5.5"] {
            assert!(is_text_chat_model(keep), "{keep}");
        }
        for drop in ["gemini-2.5-flash-preview-tts", "gemini-3-pro-image", "gemini-omni-1.2-flash", "nano-banana-pro-preview", "gemini-3.5-transcribe", "text-embedding-3-large", "gemini-3.1-pro-preview-customtools"] {
            assert!(!is_text_chat_model(drop), "{drop}");
        }
    }
}

/// Live smoke test against a real provider. Ignored by default; run with
/// `RBR_LIVE_KEY=... RBR_LIVE_PROVIDER=gemini RBR_LIVE_MODEL=... cargo test live_ -- --ignored --nocapture`.
#[cfg(test)]
mod live_tests {
    use super::*;
    use crate::ai_cli::AiChatRequest;

    #[tokio::test(flavor = "current_thread")]
    #[ignore]
    async fn live_provider_round_trip() {
        let key = std::env::var("RBR_LIVE_KEY").expect("RBR_LIVE_KEY");
        let profile = AiApiProfile {
            id: "live".into(),
            name: "live".into(),
            provider: std::env::var("RBR_LIVE_PROVIDER").unwrap_or_else(|_| "gemini".into()),
            api_key: String::new(),
            endpoint: String::new(),
            model: std::env::var("RBR_LIVE_MODEL").unwrap_or_default(),
            temperature: None,
        };
        let request = AiChatRequest {
            prompt: "把相機檔名改成 日期 + Tokyo + 三位數流水號".into(),
            history: vec![],
            sample_filenames: vec!["IMG_20260812_093015.jpg".into(), "IMG_20260813_121907.jpg".into()],
            current_pipeline: vec![],
            process_filename_only: Some(true),
            provider: None,
            task_id: None,
            model: None,
            installed_plugins: vec![],
            current_preview: vec![],
        };
        let started = std::time::Instant::now();
        let result = run_api_chat(request, profile, Some(key)).await;
        println!("elapsed: {:?}", started.elapsed());
        match result {
            Ok(resp) => {
                println!("model: {:?} usage: {:?}", resp.model, resp.usage);
                println!("reply: {}", resp.reply);
                println!("pipeline: {}", serde_json::to_string_pretty(&resp.pipeline).unwrap());
                assert!(!resp.pipeline.is_empty());
            }
            Err(e) => panic!("live call failed: {e}"),
        }
    }
}
