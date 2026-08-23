use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::ai_cli::{build_prompt, extract_json_payload, AiChatRequest, AiChatResponse};

pub const USER_AGENT: &str = "RegexBatchRenamer/0.7.0";

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiApiProfile {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub api_key: String,
    pub endpoint: String,
    pub model: String,
    pub temperature: Option<f32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiApiTestResult {
    pub success: bool,
    pub message: String,
}

pub async fn test_gemini_api_connection(profile: &AiApiProfile) -> Result<AiApiTestResult, String> {
    let provider = profile.provider.trim().to_lowercase();
    let api_key = profile.api_key.trim();
    let raw_endpoint = profile.endpoint.trim();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("建立網路連線客戶端失敗: {e}"))?;

    // 1. Ollama (Local API, No API key required by default)
    if provider == "ollama" {
        let base_endpoint = if raw_endpoint.is_empty() {
            "http://localhost:11434"
        } else {
            raw_endpoint.trim_end_matches('/')
        };

        let url = if base_endpoint.ends_with("/v1") {
            format!("{base_endpoint}/models")
        } else {
            format!("{base_endpoint}/api/tags")
        };

        let mut req = client.get(&url).header("User-Agent", USER_AGENT);
        if !api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {api_key}"));
        }

        match req.send().await {
            Ok(res) if res.status().is_success() => {
                let body = res.text().await.unwrap_or_default();
                let model_input = if profile.model.trim().is_empty() { "llama3.3" } else { profile.model.trim() };
                
                let mut installed_models = Vec::new();
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body) {
                    if let Some(models_arr) = parsed.get("models").and_then(|m| m.as_array()) {
                        for m in models_arr {
                            if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                                installed_models.push(name.to_string());
                            }
                        }
                    } else if let Some(data_arr) = parsed.get("data").and_then(|d| d.as_array()) {
                        for m in data_arr {
                            if let Some(id) = m.get("id").and_then(|n| n.as_str()) {
                                installed_models.push(id.to_string());
                            }
                        }
                    }
                }

                if installed_models.is_empty() {
                    Ok(AiApiTestResult {
                        success: true,
                        message: format!("連線成功！但本機 Ollama 尚未下載任何模型，請在終端機執行 `ollama pull {model_input}`。"),
                    })
                } else {
                    let has_exact = installed_models.iter().any(|m| m == model_input);
                    let prefix_match = installed_models.iter().find(|m| m.starts_with(model_input));
                    
                    if has_exact {
                        Ok(AiApiTestResult {
                            success: true,
                            message: format!("連線成功！模型 `{model_input}` 已就緒可用。"),
                        })
                    } else if let Some(matched) = prefix_match {
                        Ok(AiApiTestResult {
                            success: true,
                            message: format!("連線成功！本機已安裝相符模型 `{matched}`（建議設定模型名稱為完整標籤 `{matched}`）。"),
                        })
                    } else {
                        let list_str = installed_models.join(", ");
                        Ok(AiApiTestResult {
                            success: false,
                            message: format!("連線成功，但本機未安裝模型 `{model_input}`。目前本機已安裝模型：[{list_str}]。請執行 `ollama pull {model_input}` 或填寫已安裝的模型名稱。"),
                        })
                    }
                }
            }
            Ok(res) => {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                Ok(AiApiTestResult {
                    success: false,
                    message: format!("Ollama 回傳錯誤 ({status}): {body}"),
                })
            }
            Err(e) => {
                Ok(AiApiTestResult {
                    success: false,
                    message: format!("無法連線至 Ollama 服務（{base_endpoint}），請確認 Ollama 已在背景啟動: {e}"),
                })
            }
        }
    } else if provider == "openai" {
        if api_key.is_empty() {
            return Ok(AiApiTestResult {
                success: false,
                message: "API Key 不能為空，請輸入有效的 OpenAI API Key。".into(),
            });
        }
        let base_endpoint = if raw_endpoint.is_empty() { "https://api.openai.com/v1" } else { raw_endpoint.trim_end_matches('/') };
        let url = format!("{base_endpoint}/models");
        match client.get(&url).header("Authorization", format!("Bearer {api_key}")).header("User-Agent", USER_AGENT).send().await {
            Ok(res) if res.status().is_success() => {
                let model = if profile.model.trim().is_empty() { "gpt-4o-mini" } else { profile.model.trim() };
                Ok(AiApiTestResult {
                    success: true,
                    message: format!("連線成功！OpenAI API 已就緒，模型：`{model}`。"),
                })
            }
            Ok(res) => {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                Ok(AiApiTestResult {
                    success: false,
                    message: format!("OpenAI API 回傳錯誤 ({status}): {body}"),
                })
            }
            Err(e) => Ok(AiApiTestResult { success: false, message: format!("連線至 OpenAI 伺服器失敗: {e}") })
        }
    } else if provider == "anthropic" || provider == "claude" {
        if api_key.is_empty() {
            return Ok(AiApiTestResult {
                success: false,
                message: "API Key 不能為空，請輸入有效的 Anthropic API Key。".into(),
            });
        }
        let base_endpoint = if raw_endpoint.is_empty() { "https://api.anthropic.com/v1" } else { raw_endpoint.trim_end_matches('/') };
        let url = format!("{base_endpoint}/models");
        match client.get(&url).header("x-api-key", api_key).header("anthropic-version", "2023-06-01").header("User-Agent", USER_AGENT).send().await {
            Ok(res) if res.status().is_success() => {
                let model = if profile.model.trim().is_empty() { "claude-4-6-sonnet" } else { profile.model.trim() };
                Ok(AiApiTestResult {
                    success: true,
                    message: format!("連線成功！Anthropic API 已就緒，模型：`{model}`。"),
                })
            }
            Ok(res) => {
                let status = res.status();
                let body = res.text().await.unwrap_or_default();
                Ok(AiApiTestResult {
                    success: false,
                    message: format!("Anthropic API 回傳錯誤 ({status}): {body}"),
                })
            }
            Err(e) => Ok(AiApiTestResult { success: false, message: format!("連線至 Anthropic 伺服器失敗: {e}") })
        }
    } else {
        // Default / Gemini
        if api_key.is_empty() {
            return Ok(AiApiTestResult {
                success: false,
                message: "API Key 不能為空，請輸入有效的 Gemini API Key。".into(),
            });
        }

        let base_endpoint = if raw_endpoint.is_empty() {
            "https://generativelanguage.googleapis.com"
        } else {
            raw_endpoint.trim_end_matches('/')
        };

        let model = if profile.model.trim().is_empty() {
            "gemini-3.6-flash"
        } else {
            profile.model.trim()
        };

        let url = format!("{base_endpoint}/v1beta/models/{model}?key={api_key}");

        let res = client
            .get(&url)
            .header("User-Agent", USER_AGENT)
            .send()
            .await
            .map_err(|e| format!("連線至 Gemini API 伺服器失敗: {e}"))?;

        let status = res.status();
        let body_text = res.text().await.unwrap_or_default();

        if status.is_success() {
            Ok(AiApiTestResult {
                success: true,
                message: format!("連線成功！模型 `{model}` 已就緒可用。"),
            })
        } else {
            let err_msg = if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&body_text) {
                err_json
                    .get("error")
                    .and_then(|e| e.get("message"))
                    .and_then(|m| m.as_str())
                    .unwrap_or(&body_text)
                    .to_string()
            } else {
                body_text
            };

            Ok(AiApiTestResult {
                success: false,
                message: format!("連線失敗 ({status}): {err_msg}"),
            })
        }
    }
}

fn parse_chat_response(raw_content: &str) -> Result<AiChatResponse, String> {
    if let Some(json_str) = extract_json_payload(raw_content) {
        if let Ok(chat_resp) = serde_json::from_str::<AiChatResponse>(json_str) {
            return Ok(chat_resp);
        }
    }

    if let Ok(chat_resp) = serde_json::from_str::<AiChatResponse>(raw_content.trim()) {
        return Ok(chat_resp);
    }

    Ok(AiChatResponse {
        reply: raw_content.to_string(),
        explanation: None,
        pipeline: Vec::new(),
    })
}



pub async fn run_api_chat(
    request: AiChatRequest,
    profile: AiApiProfile,
) -> Result<AiChatResponse, String> {
    let task_id = request.task_id.clone();
    let mut cancel_rx = task_id.as_deref().map(crate::ai_task::register_task);

    let provider = profile.provider.trim().to_lowercase();
    let result = match provider.as_str() {
        "ollama" => run_ollama_chat_inner(request, profile, &mut cancel_rx).await,
        "openai" => run_openai_chat_inner(request, profile, &mut cancel_rx).await,
        "anthropic" | "claude" => run_anthropic_chat_inner(request, profile, &mut cancel_rx).await,
        _ => run_gemini_chat_inner(request, profile, &mut cancel_rx).await,
    };

    if let Some(ref tid) = task_id {
        crate::ai_task::finish_task(tid);
    }

    result
}

async fn resolve_ollama_model(client: &reqwest::Client, base_endpoint: &str, model_input: &str, api_key: &str) -> String {
    let tags_url = if base_endpoint.ends_with("/v1") {
        let root = base_endpoint.trim_end_matches("/v1");
        format!("{root}/api/tags")
    } else {
        format!("{base_endpoint}/api/tags")
    };

    let mut req = client.get(&tags_url).header("User-Agent", USER_AGENT);
    if !api_key.is_empty() {
        req = req.header("Authorization", format!("Bearer {api_key}"));
    }

    if let Ok(res) = req.send().await {
        if res.status().is_success() {
            if let Ok(body) = res.text().await {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body) {
                    if let Some(models_arr) = parsed.get("models").and_then(|m| m.as_array()) {
                        let mut names = Vec::new();
                        for m in models_arr {
                            if let Some(name) = m.get("name").and_then(|n| n.as_str()) {
                                names.push(name.to_string());
                            }
                        }

                        if names.iter().any(|n| n == model_input) {
                            return model_input.to_string();
                        }
                        let prefix = format!("{model_input}:");
                        if let Some(found) = names.iter().find(|n| n.starts_with(&prefix)) {
                            return found.clone();
                        }
                        if let Some(found) = names.iter().find(|n| n.starts_with(model_input)) {
                            return found.clone();
                        }
                        if names.len() == 1 {
                            return names[0].clone();
                        }
                    }
                }
            }
        }
    }

    model_input.to_string()
}

async fn run_ollama_chat_inner(
    request: AiChatRequest,
    profile: AiApiProfile,
    cancel_rx: &mut Option<tokio::sync::oneshot::Receiver<()>>,
) -> Result<AiChatResponse, String> {
    let raw_endpoint = profile.endpoint.trim();
    let base_endpoint = if raw_endpoint.is_empty() {
        "http://localhost:11434"
    } else {
        raw_endpoint.trim_end_matches('/')
    };

    let raw_model = if profile.model.trim().is_empty() {
        "llama3.1"
    } else {
        profile.model.trim()
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("建立網路連線客戶端失敗: {e}"))?;

    // Auto-resolve model tag (e.g. llama3.1 -> llama3.1:8b)
    let model = resolve_ollama_model(&client, base_endpoint, raw_model, profile.api_key.trim()).await;

    let full_prompt = build_prompt(&request);
    let temperature = profile.temperature.unwrap_or(0.2);

    let is_v1 = base_endpoint.ends_with("/v1");
    let (url, payload) = if is_v1 {
        let u = format!("{base_endpoint}/chat/completions");
        let p = json!({
            "model": model,
            "messages": [
                { "role": "user", "content": full_prompt }
            ],
            "temperature": temperature
        });
        (u, p)
    } else {
        let u = format!("{base_endpoint}/api/chat");
        let p = json!({
            "model": model,
            "messages": [
                { "role": "user", "content": full_prompt }
            ],
            "stream": false,
            "format": "json",
            "options": {
                "temperature": temperature
            }
        });
        (u, p)
    };

    let mut req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("User-Agent", USER_AGENT)
        .json(&payload);

    if !profile.api_key.trim().is_empty() {
        req_builder = req_builder.header("Authorization", format!("Bearer {}", profile.api_key.trim()));
    }

    let res = if let Some(rx) = cancel_rx.as_mut() {
        tokio::select! {
            r = req_builder.send() => {
                r.map_err(|e| format!("Ollama API 請求失敗: {e}"))?
            }
            _ = rx => {
                return Err("AI_TASK_CANCELLED".into());
            }
        }
    } else {
        req_builder.send().await.map_err(|e| format!("Ollama API 請求失敗: {e}"))?
    };

    let status = res.status();
    let body_text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        if status.as_u16() == 404 && body_text.contains("not found") {
            return Err(format!(
                "Ollama 回報模型 `{model}` 不存在。請確認本機是否有下載該模型（例如完整標籤 `{model}:8b` 或 `{model}:latest`），或在終端機執行 `ollama pull {model}`。"
            ));
        }
        return Err(format!("Ollama API 回傳錯誤 ({status}): {body_text}"));
    }

    let parsed: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("解析 Ollama 回應結構失敗: {e} (Raw: {body_text})"))?;

    let raw_content = parsed
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .or_else(|| {
            parsed
                .get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c0| c0.get("message"))
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_str())
        })
        .ok_or_else(|| format!("無法從 Ollama 回應中取得生成文字 (Raw: {body_text})"))?;

    parse_chat_response(raw_content)
}

async fn run_openai_chat_inner(
    request: AiChatRequest,
    profile: AiApiProfile,
    cancel_rx: &mut Option<tokio::sync::oneshot::Receiver<()>>,
) -> Result<AiChatResponse, String> {
    let api_key = profile.api_key.trim();
    if api_key.is_empty() {
        return Err("尚未設定 OpenAI API Key，請至「設定 > AI 助理」填入 API Key。".into());
    }

    let raw_endpoint = profile.endpoint.trim();
    let base_endpoint = if raw_endpoint.is_empty() {
        "https://api.openai.com/v1"
    } else {
        raw_endpoint.trim_end_matches('/')
    };

    let model = if profile.model.trim().is_empty() {
        "gpt-4o-mini"
    } else {
        profile.model.trim()
    };

    let full_prompt = build_prompt(&request);
    let temperature = profile.temperature.unwrap_or(0.2);

    let url = if base_endpoint.ends_with("/chat/completions") {
        base_endpoint.to_string()
    } else {
        format!("{base_endpoint}/chat/completions")
    };

    let payload = json!({
        "model": model,
        "messages": [
            { "role": "user", "content": full_prompt }
        ],
        "temperature": temperature,
        "response_format": { "type": "json_object" }
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("建立網路連線客戶端失敗: {e}"))?;

    let req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {api_key}"))
        .header("User-Agent", USER_AGENT)
        .json(&payload);

    let res = if let Some(rx) = cancel_rx.as_mut() {
        tokio::select! {
            r = req_builder.send() => {
                r.map_err(|e| format!("OpenAI API 請求失敗: {e}"))?
            }
            _ = rx => {
                return Err("AI_TASK_CANCELLED".into());
            }
        }
    } else {
        req_builder.send().await.map_err(|e| format!("OpenAI API 請求失敗: {e}"))?
    };

    let status = res.status();
    let body_text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("OpenAI API 回傳錯誤 ({status}): {body_text}"));
    }

    let parsed: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("解析 OpenAI 回應結構失敗: {e} (Raw: {body_text})"))?;

    let raw_content = parsed
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c0| c0.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or_else(|| format!("無法從 OpenAI 回應中取得生成文字 (Raw: {body_text})"))?;

    parse_chat_response(raw_content)
}

async fn run_anthropic_chat_inner(
    request: AiChatRequest,
    profile: AiApiProfile,
    cancel_rx: &mut Option<tokio::sync::oneshot::Receiver<()>>,
) -> Result<AiChatResponse, String> {
    let api_key = profile.api_key.trim();
    if api_key.is_empty() {
        return Err("尚未設定 Anthropic API Key，請至「設定 > AI 助理」填入 API Key。".into());
    }

    let raw_endpoint = profile.endpoint.trim();
    let base_endpoint = if raw_endpoint.is_empty() {
        "https://api.anthropic.com/v1"
    } else {
        raw_endpoint.trim_end_matches('/')
    };

    let model = if profile.model.trim().is_empty() {
        "claude-4-6-sonnet"
    } else {
        profile.model.trim()
    };

    let full_prompt = build_prompt(&request);
    let temperature = profile.temperature.unwrap_or(0.2);

    let url = if base_endpoint.ends_with("/messages") {
        base_endpoint.to_string()
    } else {
        format!("{base_endpoint}/messages")
    };

    let payload = json!({
        "model": model,
        "max_tokens": 4096,
        "messages": [
            { "role": "user", "content": full_prompt }
        ],
        "temperature": temperature
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("建立網路連線客戶端失敗: {e}"))?;

    let req_builder = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("User-Agent", USER_AGENT)
        .json(&payload);

    let res = if let Some(rx) = cancel_rx.as_mut() {
        tokio::select! {
            r = req_builder.send() => {
                r.map_err(|e| format!("Anthropic API 請求失敗: {e}"))?
            }
            _ = rx => {
                return Err("AI_TASK_CANCELLED".into());
            }
        }
    } else {
        req_builder.send().await.map_err(|e| format!("Anthropic API 請求失敗: {e}"))?
    };

    let status = res.status();
    let body_text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("Anthropic API 回傳錯誤 ({status}): {body_text}"));
    }

    let parsed: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("解析 Anthropic 回應結構失敗: {e} (Raw: {body_text})"))?;

    let raw_content = parsed
        .get("content")
        .and_then(|c| c.get(0))
        .and_then(|c0| c0.get("text"))
        .and_then(|t| t.as_str())
        .ok_or_else(|| format!("無法從 Anthropic 回應中取得生成文字 (Raw: {body_text})"))?;

    parse_chat_response(raw_content)
}

async fn run_gemini_chat_inner(
    request: AiChatRequest,
    profile: AiApiProfile,
    cancel_rx: &mut Option<tokio::sync::oneshot::Receiver<()>>,
) -> Result<AiChatResponse, String> {
    let api_key = profile.api_key.trim();
    if api_key.is_empty() {
        return Err("尚未設定 Gemini API Key，請至「設定 > AI 助理」填入 API Key。".into());
    }

    let raw_endpoint = profile.endpoint.trim();
    let base_endpoint = if raw_endpoint.is_empty() {
        "https://generativelanguage.googleapis.com"
    } else {
        raw_endpoint.trim_end_matches('/')
    };

    let model = if profile.model.trim().is_empty() {
        "gemini-3.6-flash"
    } else {
        profile.model.trim()
    };

    let full_prompt = build_prompt(&request);

    let url = format!("{base_endpoint}/v1beta/models/{model}:generateContent?key={api_key}");

    let temperature = profile.temperature.unwrap_or(0.2);

    let payload = json!({
        "contents": [
            {
                "role": "user",
                "parts": [
                    { "text": full_prompt }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": temperature
        }
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("建立網路連線客戶端失敗: {e}"))?;

    let res = if let Some(rx) = cancel_rx.as_mut() {
        tokio::select! {
            r = client
                .post(&url)
                .header("Content-Type", "application/json")
                .header("User-Agent", USER_AGENT)
                .json(&payload)
                .send() => {
                    r.map_err(|e| format!("Gemini API 請求失敗: {e}"))?
            }
            _ = rx => {
                return Err("AI_TASK_CANCELLED".into());
            }
        }
    } else {
        client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("User-Agent", USER_AGENT)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Gemini API 請求失敗: {e}"))?
    };

    let status = res.status();
    let body_text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        let err_msg = if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&body_text) {
            err_json
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .unwrap_or(&body_text)
                .to_string()
        } else {
            body_text
        };
        return Err(format!("Gemini API 回傳錯誤 ({status}): {err_msg}"));
    }

    let parsed_resp: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("解析 Gemini API 回應結構失敗: {e} (Raw: {body_text})"))?;

    let raw_content = parsed_resp
        .get("candidates")
        .and_then(|c| c.get(0))
        .and_then(|c0| c0.get("content"))
        .and_then(|cnt| cnt.get("parts"))
        .and_then(|parts| parts.get(0))
        .and_then(|p0| p0.get("text"))
        .and_then(|t| t.as_str())
        .ok_or_else(|| {
            format!("無法從 Gemini 回應中取得生成文字 (Raw: {body_text})")
        })?;

    parse_chat_response(raw_content)
}
