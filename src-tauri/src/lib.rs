use tauri::{AppHandle, Emitter, Manager, Runtime};
use tiny_http::{Header, Method, Response, Server};
use std::sync::Mutex;
use std::collections::HashMap;
use std::time::{Instant, Duration};
use once_cell::sync::Lazy;
use serde_json::{json, Value};

struct CacheEntry {
    data: String,
    timestamp: Instant,
}

static ANALYSIS_CACHE: Lazy<Mutex<HashMap<String, CacheEntry>>> = Lazy::new(|| {
    Mutex::new(HashMap::new())
});

const CACHE_TTL: Duration = Duration::from_secs(600); // 10 minutes

// Shared state for the HTTP server
pub struct AppState {
    pub base_download_path: Mutex<String>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct AddUrlPayload {
    pub url: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub auto_start: Option<bool>,
    #[serde(default)]
    pub quality: Option<String>,
    #[serde(default)]
    pub subtitle_lang: Option<String>,
    #[serde(default)]
    pub estimated_size: Option<u64>,
    #[serde(default)]
    pub thumbnail: Option<String>,
    #[serde(default)]
    pub instant: Option<bool>,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    #[serde(default)]
    pub selected_entries: Option<Vec<serde_json::Value>>,
    #[serde(default)]
    pub is_playlist: Option<bool>,
    #[serde(default)]
    pub playlist_title: Option<String>,
    #[serde(default)]
    pub download_path: Option<String>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct SummarizePayload {
    pub url: String,
    pub lang: Option<String>,
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct DefaultsPayload {
    pub base_download_path: String,
}

pub fn start_http_server<R: Runtime>(app_handle: AppHandle<R>) {
    // Load .env file
    let _ = dotenvy::dotenv();

    // Initialize state if not already managed
    if app_handle.try_state::<AppState>().is_none() {
        app_handle.manage(AppState {
            base_download_path: Mutex::new(String::new()),
        });
    }

    let app_handle_inner = app_handle.clone();
    std::thread::spawn(move || {
        let server: Server = match Server::http("127.0.0.1:7433") {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[OmniHTTP] Failed to start server: {}", e);
                return;
            }
        };
        println!("[OmniHTTP] Listening on http://127.0.0.1:7433");

        for mut request in server.incoming_requests() {
            // CORS preflight
            if *request.method() == Method::Options {
                let response = Response::empty(204)
                    .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap())
                    .with_header(Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"POST, GET, OPTIONS"[..]).unwrap())
                    .with_header(Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type"[..]).unwrap());
                let _ = request.respond(response);
                continue;
            }

            let url_path = request.url().to_string();
            let mut body = String::new();
            if *request.method() == Method::Post {
                let _ = request.as_reader().read_to_string(&mut body).ok();
            }

            let response_body = match (request.method(), url_path.as_str()) {
                (Method::Get, "/status") => r#"{"status":"online"}"#.to_string(),
                
                (Method::Get, "/defaults") => {
                    if let Some(state) = app_handle_inner.try_state::<AppState>() {
                        let path = state.base_download_path.lock().unwrap().clone();
                        serde_json::json!({
                            "status": "ok",
                            "base_download_path": path
                        }).to_string()
                    } else {
                        r#"{"status":"error","message":"State not initialized"}"#.to_string()
                    }
                }

                (Method::Post, "/set-defaults") => {
                    match serde_json::from_str::<DefaultsPayload>(&body) {
                        Ok(p) => {
                            if let Some(state) = app_handle_inner.try_state::<AppState>() {
                                *state.base_download_path.lock().unwrap() = p.base_download_path;
                                r#"{"status":"ok"}"#.to_string()
                            } else {
                                r#"{"status":"error"}"#.to_string()
                            }
                        }
                        _ => r#"{"status":"error"}"#.to_string()
                    }
                }

                (Method::Get, path) if path.starts_with("/analyze") => {
                    let url_param = path.split("url=").collect::<Vec<&str>>().get(1)
                        .map(|s| s.split('&').next().unwrap_or(s))
                        .map(|s| urlencoding::decode(s).unwrap_or(s.into()).to_string())
                        .unwrap_or_default();

                    if url_param.is_empty() {
                        r#"{"error":"Missing URL"}"#.to_string()
                    } else {
                        // Check Cache First 🧠
                        let cached_data = {
                            let mut cache = ANALYSIS_CACHE.lock().unwrap();
                            if let Some(entry) = cache.get(&url_param) {
                                if entry.timestamp.elapsed() < CACHE_TTL {
                                    println!("[OmniHTTP] Cache HIT for: {}", url_param);
                                    Some(entry.data.clone())
                                } else {
                                    cache.remove(&url_param);
                                    None
                                }
                            } else {
                                None
                            }
                        };

                        if let Some(data) = cached_data {
                            data
                        } else {
                            // Resolve and run sidecar
                            use tauri_plugin_shell::ShellExt;
                            let sidecar = app_handle_inner.shell().sidecar("ytdlp");
                            
                            match sidecar {
                                Ok(sc) => {
                                    // Add arguments and run (using block_on because we are in a synchronous thread)
                                    let output = tauri::async_runtime::block_on(
                                        sc.args(&["--dump-single-json", "--no-playlist", "--flat-playlist", &url_param])
                                            .output()
                                    );
                                    
                                    match output {
                                        Ok(out) if out.status.success() => {
                                            let json_data = String::from_utf8_lossy(&out.stdout).to_string();
                                            
                                            // Update Cache 📝
                                            {
                                                let mut cache = ANALYSIS_CACHE.lock().unwrap();
                                                cache.insert(url_param.clone(), CacheEntry {
                                                    data: json_data.clone(),
                                                    timestamp: Instant::now(),
                                                });
                                            }
                                            
                                            json_data
                                        }
                                        Ok(out) => {
                                            let err = String::from_utf8_lossy(&out.stderr);
                                            serde_json::json!({ "error": "Analysis failed", "details": err }).to_string()
                                        }
                                        Err(e) => serde_json::json!({ "error": "Failed to run sidecar", "details": e.to_string() }).to_string()
                                    }
                                }
                                Err(e) => serde_json::json!({ "error": "Sidecar not found", "details": e.to_string() }).to_string()
                            }
                        }
                    }
                }

                (Method::Post, "/add") => {
                    match serde_json::from_str::<AddUrlPayload>(&body) {
                        Ok(p) if !p.url.is_empty() => {
                            println!("[OmniHTTP] Received URL: {}", p.url);
                            let _ = app_handle_inner.emit("omni://add-url", &p);
                            
                            if !p.instant.unwrap_or(false) {
                                if let Some(window) = app_handle_inner.get_webview_window("main") {
                                    let _ = window.show().ok();
                                    let _ = window.unminimize().ok();
                                    let _ = window.set_focus().ok();
                                }
                            }
                            r#"{"status":"ok"}"#.to_string()
                        }
                        _ => r#"{"status":"error","message":"Invalid payload"}"#.to_string()
                    }
                }

                (Method::Post, "/summarize") => {
                    match serde_json::from_str::<SummarizePayload>(&body) {
                        Ok(p) => {
                            let url = p.url.clone();
                            let lang = p.lang.unwrap_or_else(|| "en".to_string());
                            
                            // 1. Get Metadata to find subtitle URLs
                            use tauri_plugin_shell::ShellExt;
                            let sidecar = app_handle_inner.shell().sidecar("ytdlp");
                            
                            let summary_result = match sidecar {
                                Ok(sc) => {
                                    let output = tauri::async_runtime::block_on(
                                        sc.args(&["--dump-single-json", "--no-playlist", "--flat-playlist", &url])
                                            .output()
                                    );
                                    
                                    match output {
                                        Ok(out) if out.status.success() => {
                                            let json_data: Value = serde_json::from_slice(&out.stdout).unwrap_or(json!({}));
                                            
                                            // 2. Extract Transcript URL (prefer json3 for easier parsing)
                                            let transcript_url = extract_transcript_url(&json_data, &lang);
                                            
                                            match transcript_url {
                                                Some(t_url) => {
                                                    // 3. Fetch and Parse Transcript
                                                    let transcript = tauri::async_runtime::block_on(async {
                                                        fetch_and_clean_transcript(&t_url).await
                                                    });
                                                    
                                                    match transcript {
                                                        Ok(text) if !text.is_empty() => {
                                                            // 4. Call Gemini API
                                                            let api_key = std::env::var("VITE_GEMINI_API_KEY").unwrap_or_default();
                                                            if api_key.is_empty() {
                                                                json!({ "error": "Gemini API key not found in .env" })
                                                            } else {
                                                                let gemini_res = tauri::async_runtime::block_on(async {
                                                                    call_gemini(&api_key, &text, &lang).await
                                                                });
                                                                match gemini_res {
                                                                    Ok(summary) => json!({ "status": "ok", "summary": summary }),
                                                                    Err(e) => json!({ "error": format!("Gemini API failed: {}", e) })
                                                                }
                                                            }
                                                        }
                                                        _ => json!({ "error": "Could not extract clean transcript" })
                                                    }
                                                }
                                                None => json!({ "error": format!("No transcript found for language: {}", lang) })
                                            }
                                        }
                                        _ => json!({ "error": "Metadata analysis failed" })
                                    }
                                }
                                Err(e) => json!({ "error": format!("Sidecar error: {}", e) })
                            };
                            summary_result.to_string()
                        }
                        _ => json!({ "error": "Invalid payload" }).to_string()
                    }
                }

                _ => r#"{"status":"error","message":"Not Found"}"#.to_string()
            };

            let response = Response::from_string(response_body)
                .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
            let _ = request.respond(response);
        }
    });
}

fn extract_transcript_url(json: &Value, lang: &str) -> Option<String> {
    let check_section = |section: &Value| -> Option<String> {
        if let Some(subs) = section.as_object() {
            // 1. Try exact match
            if let Some(lang_subs) = subs.get(lang) {
                if let Some(arr) = lang_subs.as_array() {
                    for entry in arr {
                        if entry.get("ext").and_then(|v| v.as_str()) == Some("json3") {
                            return entry.get("url").and_then(|v| v.as_str()).map(|s| s.to_string());
                        }
                    }
                    return arr.get(0).and_then(|e| e.get("url")).and_then(|v| v.as_str()).map(|s| s.to_string());
                }
            }
            // 2. Try prefix match (e.g. "en" matches "en-US")
            for (key, val) in subs {
                if key.starts_with(lang) {
                    if let Some(arr) = val.as_array() {
                         for entry in arr {
                            if entry.get("ext").and_then(|v| v.as_str()) == Some("json3") {
                                return entry.get("url").and_then(|v| v.as_str()).map(|s| s.to_string());
                            }
                        }
                        return arr.get(0).and_then(|e| e.get("url")).and_then(|v| v.as_str()).map(|s| s.to_string());
                    }
                }
            }
        }
        None
    };

    if let Some(subs) = json.get("subtitles") {
        if let Some(url) = check_section(subs) { return Some(url); }
    }
    if let Some(auto) = json.get("automatic_captions") {
        if let Some(url) = check_section(auto) { return Some(url); }
    }
    None
}

async fn fetch_and_clean_transcript(url: &str) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let res = client.get(url).send().await?;
    
    if !res.status().is_success() {
        return Err(format!("Failed to fetch transcript from YouTube: {}", res.status()).into());
    }

    let json_sub: Value = res.json().await?;
    
    let mut text = String::new();
    if let Some(events) = json_sub.get("events").and_then(|v| v.as_array()) {
        for event in events {
            if let Some(segs) = event.get("segs").and_then(|v| v.as_array()) {
                for seg in segs {
                    if let Some(utf8) = seg.get("utf8").and_then(|v| v.as_str()) {
                        text.push_str(utf8);
                    }
                }
                text.push(' ');
            }
        }
    }
    
    let cleaned = text.trim().to_string();
    if cleaned.is_empty() {
        return Err("Transcript is empty after cleaning".into());
    }
    
    Ok(cleaned)
}

async fn call_gemini(api_key: &str, transcript: &str, lang: &str) -> Result<String, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}", api_key);
    
    let prompt = format!(
        "قم بتلخيص هذا النص المستخرج من فيديو يوتيوب على شكل نقاط رئيسية (Bullet Points) مع خاتمة، واجعله باللغة {}.\n\nالنص:\n{}",
        lang, transcript
    );
    
    let payload = json!({
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }]
    });
    
    println!("[Gemini] Sending request to API...");
    let res = client.post(&url)
        .json(&payload)
        .send()
        .await?;
    
    let status = res.status();
    let res_json: Value = res.json().await?;
    
    if !status.is_success() {
        let err_msg = res_json.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()).unwrap_or("Unknown API Error");
        println!("[Gemini] API Error {}: {}", status, err_msg);
        return Err(format!("Gemini API Error ({}): {}", status, err_msg).into());
    }

    if let Some(candidates) = res_json.get("candidates").and_then(|v| v.as_array()) {
        if let Some(candidate) = candidates.get(0) {
             // Check for safety or other finish reasons
            if let Some(reason) = candidate.get("finishReason").and_then(|v| v.as_str()) {
                if reason == "SAFETY" {
                    return Err("Summarization was blocked by safety filters.".into());
                }
            }

            if let Some(text) = candidate.get("content").and_then(|c| c.get("parts")).and_then(|p| p.as_array()).and_then(|arr| arr.get(0)).and_then(|p| p.get("text")).and_then(|v| v.as_str()) {
                println!("[Gemini] Summarization successful.");
                return Ok(text.to_string());
            }
        }
    }
    
    println!("[Gemini] Failed to parse response: {:?}", res_json);
    Err(format!("Failed to parse Gemini response: {}", res_json).into())
}
