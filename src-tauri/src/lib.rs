// src-tauri/src/lib.rs
use tauri::{AppHandle, Emitter, Manager};
use tiny_http::{Header, Method, Response, Server};

#[derive(Debug, serde::Deserialize)]
struct AddUrlPayload {
    url: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    auto_start: Option<bool>,
}

pub fn start_http_server(app_handle: AppHandle) {
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
                    .with_header(
                        Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                    )
                    .with_header(
                        Header::from_bytes(
                            &b"Access-Control-Allow-Methods"[..],
                            &b"POST, GET, OPTIONS"[..],
                        )
                        .unwrap(),
                    )
                    .with_header(
                        Header::from_bytes(
                            &b"Access-Control-Allow-Headers"[..],
                            &b"Content-Type"[..],
                        )
                        .unwrap(),
                    );
                let _ = request.respond(response);
                continue;
            }

            // Read body if POST
            let mut body = String::new();
            if *request.method() == Method::Post {
                let _ = request.as_reader().read_to_string(&mut body).ok();
            }

            let response_body;
            let url_path = request.url().to_string();

            if url_path == "/status" {
                response_body = r#"{"status":"online"}"#.to_string();
            } else if url_path == "/add" && *request.method() == Method::Post {
                match serde_json::from_str::<AddUrlPayload>(&body) {
                    Ok(payload) if !payload.url.is_empty() => {
                        println!("[OmniHTTP] Received URL: {}", payload.url);
                        // Emit event to frontend
                        let _ = app_handle.emit(
                            "omni://add-url",
                            serde_json::json!({
                                "url": payload.url,
                                "title": payload.title,
                                "auto_start": payload.auto_start.unwrap_or(false)
                            }),
                        );
                        // Bring window to front
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show().ok();
                            let _ = window.unminimize().ok();
                            let _ = window.set_focus().ok();
                        }
                        response_body = r#"{"status":"ok"}"#.to_string();
                    }
                    _ => {
                        response_body =
                            r#"{"status":"error","message":"Invalid payload"}"#.to_string();
                    }
                }
            } else {
                response_body = r#"{"status":"error","message":"Not Found"}"#.to_string();
            }

            let response = Response::from_string(response_body)
                .with_header(
                    Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap(),
                )
                .with_header(
                    Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                );
            let _ = request.respond(response);
        }
    });
}
