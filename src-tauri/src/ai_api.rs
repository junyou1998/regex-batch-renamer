use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::ai_cli::{build_prompt, extract_json_payload, AiChatRequest, AiChatResponse};

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

        let mut req = client.get(&url).header("User-Agent", "RegexBatchRenamer/0.6.0");
        if !api_key.is_empty() {
            req = req.header("Authorization", format!("Bearer {api_key}"));
        }

        match req.send().await {
            Ok(res) if res.status().is_success() => {
                let model = if profile.model.trim().is_empty() { "llama3.3" } else { profile.model.trim() };
                Ok(AiApiTestResult {
                    success: true,
                    message: format!("連線成功！Ollama 本地服務正常運作，預設模型：`{model}`。"),
                })
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
        match client.get(&url).header("Authorization", format!("Bearer {api_key}")).header("User-Agent", "RegexBatchRenamer/0.6.0").send().await {
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
        match client.get(&url).header("x-api-key", api_key).header("anthropic-version", "2023-06-01").header("User-Agent", "RegexBatchRenamer/0.6.0").send().await {
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
            .header("User-Agent", "RegexBatchRenamer/0.6.0")
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

pub async fn run_gemini_api_chat(
    request: AiChatRequest,
    profile: AiApiProfile,
) -> Result<AiChatResponse, String> {
    let task_id = request.task_id.clone();
    let mut cancel_rx = task_id.as_deref().map(crate::ai_task::register_task);

    let result = run_gemini_api_chat_inner(request, profile, &mut cancel_rx).await;

    if let Some(ref tid) = task_id {
        crate::ai_task::finish_task(tid);
    }

    result
}

async fn run_gemini_api_chat_inner(
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
                .header("User-Agent", "RegexBatchRenamer/0.6.0")
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
            .header("User-Agent", "RegexBatchRenamer/0.6.0")
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

    // Parse extracted JSON content into AiChatResponse
    if let Some(json_str) = extract_json_payload(raw_content) {
        if let Ok(chat_resp) = serde_json::from_str::<AiChatResponse>(json_str) {
            return Ok(chat_resp);
        }
    }

    // Direct parse fallback
    if let Ok(chat_resp) = serde_json::from_str::<AiChatResponse>(raw_content.trim()) {
        return Ok(chat_resp);
    }

    // Fallback: wrap raw text in response
    Ok(AiChatResponse {
        reply: raw_content.to_string(),
        explanation: None,
        pipeline: Vec::new(),
    })
}
