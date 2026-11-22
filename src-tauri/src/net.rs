//! Outbound HTTP on behalf of the webview.
//!
//! The webview's CSP blocks direct network access, so plugin traffic and
//! marketplace downloads go through these commands. They only allow public
//! HTTPS endpoints (no loopback or private-network hosts) and cap response size.

use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::time::Duration;

const MAX_RESPONSE_BYTES: usize = 32 * 1024 * 1024;
const USER_AGENT: &str = concat!("Renamix/", env!("CARGO_PKG_VERSION"));

fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_loopback()
                || v4.is_private()
                || v4.is_link_local()
                || v4.is_unspecified()
                || v4.is_broadcast()
                || v4.octets()[0] == 100 && (64..=127).contains(&v4.octets()[1]) // CGNAT
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || (v6.segments()[0] & 0xfe00) == 0xfc00 // unique local
                || (v6.segments()[0] & 0xffc0) == 0xfe80 // link local
                || v6.to_ipv4_mapped().map(|v4| is_private_ip(&IpAddr::V4(v4))).unwrap_or(false)
        }
    }
}

/// Only public HTTPS URLs are allowed.
pub fn validate_public_https(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|_| "INVALID_URL".to_string())?;
    if url.scheme() != "https" {
        return Err("HTTPS_REQUIRED".into());
    }
    let host = url.host_str().ok_or_else(|| "INVALID_URL".to_string())?;
    let lowered = host.trim_end_matches('.').to_ascii_lowercase();
    if lowered == "localhost" || lowered.ends_with(".localhost") || lowered.ends_with(".local") {
        return Err("PRIVATE_HOST_BLOCKED".into());
    }
    let bare = lowered.trim_start_matches('[').trim_end_matches(']');
    if let Ok(ip) = bare.parse::<IpAddr>() {
        if is_private_ip(&ip) {
            return Err("PRIVATE_HOST_BLOCKED".into());
        }
    }
    Ok(url)
}

fn client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .user_agent(USER_AGENT)
        // Re-validate every redirect hop so a public URL can't bounce to a private one.
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() > 5 {
                attempt.error("too many redirects")
            } else if validate_public_https(attempt.url().as_str()).is_err() {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|e| e.to_string())
}

async fn read_capped(response: reqwest::Response) -> Result<Vec<u8>, String> {
    if let Some(len) = response.content_length() {
        if len as usize > MAX_RESPONSE_BYTES {
            return Err("RESPONSE_TOO_LARGE".into());
        }
    }
    let bytes = response.bytes().await.map_err(|e| e.without_url().to_string())?;
    if bytes.len() > MAX_RESPONSE_BYTES {
        return Err("RESPONSE_TOO_LARGE".into());
    }
    Ok(bytes.to_vec())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpProxyRequest {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
    pub body: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpProxyResponse {
    pub status: u16,
    pub status_text: String,
    pub body: String,
}

/// Generic GET/POST used by plugins that declare the `network` permission.
pub async fn proxy_request(request: HttpProxyRequest) -> Result<HttpProxyResponse, String> {
    let url = validate_public_https(&request.url)?;
    let client = client(30)?;
    let mut builder = match request.method.to_ascii_uppercase().as_str() {
        "GET" => client.get(url),
        "POST" => client.post(url),
        _ => return Err("METHOD_NOT_ALLOWED".into()),
    };
    for (key, value) in &request.headers {
        let lowered = key.to_ascii_lowercase();
        if matches!(lowered.as_str(), "host" | "cookie" | "user-agent") {
            continue;
        }
        builder = builder.header(key, value);
    }
    if let Some(body) = request.body {
        builder = builder.body(body);
    }
    let response = builder.send().await.map_err(|e| e.without_url().to_string())?;
    let status = response.status();
    let bytes = read_capped(response).await?;
    Ok(HttpProxyResponse {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_string(),
        body: String::from_utf8_lossy(&bytes).to_string(),
    })
}

/// Download a marketplace index, README or plugin package.
pub async fn fetch_bytes(url: &str) -> Result<Vec<u8>, String> {
    let url = validate_public_https(url)?;
    let response = client(60)?.get(url).send().await.map_err(|e| e.without_url().to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP_{}", response.status().as_u16()));
    }
    read_capped(response).await
}

#[cfg(test)]
mod tests {
    use super::validate_public_https;

    #[test]
    fn blocks_non_https_and_private_hosts() {
        assert!(validate_public_https("https://api.zhconvert.org/convert").is_ok());
        assert!(validate_public_https("http://example.com").is_err());
        assert!(validate_public_https("https://localhost:11434").is_err());
        assert!(validate_public_https("https://127.0.0.1/").is_err());
        assert!(validate_public_https("https://192.168.1.2/").is_err());
        assert!(validate_public_https("https://[::1]/").is_err());
        assert!(validate_public_https("file:///etc/passwd").is_err());
    }
}
