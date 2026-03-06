// src-tauri/src/lib.rs
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tiny_http::{Header, Method, Response, Server};
use std::sync::Mutex;

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
}

#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct DefaultsPayload {
    pub base_download_path: String,
}

pub fn start_http_server<R: Runtime>(app_handle: AppHandle<R>) {
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

                    if !url_param.is_empty() {
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
                                        String::from_utf8_lossy(&out.stdout).to_string()
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
                    } else {
                        r#"{"error":"Missing URL"}"#.to_string()
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

                _ => r#"{"status":"error","message":"Not Found"}"#.to_string()
            };

            let response = Response::from_string(response_body)
                .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
            let _ = request.respond(response);
        }
    });
}
