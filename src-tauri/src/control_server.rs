use crate::control_protocol::{CommandKind, ControlError, ControlRequest, ControlResponse};
use crate::document_bridge;
use crate::session_runtime;
use crate::webview_api::ScriptResultBridgeState;
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub const CONTROL_ADDR: &str = "127.0.0.1:47831";

pub fn start_control_server(app: AppHandle) -> Result<(), String> {
    let listener = TcpListener::bind(CONTROL_ADDR).map_err(|error| error.to_string())?;

    thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else {
                continue;
            };

            let app_handle = app.clone();
            thread::spawn(move || {
                if let Err(error) = handle_stream(app_handle, stream) {
                    eprintln!("control server error: {error}");
                }
            });
        }
    });

    Ok(())
}

fn handle_stream(app: AppHandle, mut stream: TcpStream) -> Result<(), String> {
    let request_body = read_http_body(&mut stream)?;
    let response = match serde_json::from_slice::<ControlRequest>(&request_body) {
        Ok(request) => handle_request(&app, request),
        Err(error) => {
            let fallback = ControlRequest {
                command: "invalid".to_string(),
                payload: Value::Null,
                request_id: "invalid-request".to_string(),
                session_id: None,
                source: None,
                timeout_ms: 1_000,
            };

            ControlResponse::error(
                &fallback,
                ControlError::new("VALIDATION_FAILED", error.to_string()),
            )
        }
    };

    write_http_json_response(&mut stream, &response)
}

fn handle_request(app: &AppHandle, request: ControlRequest) -> ControlResponse {
    let command_kind = match request.validate() {
        Ok(command_kind) => command_kind,
        Err(error) => return ControlResponse::error(&request, error),
    };

    let timeout = Duration::from_millis(request.validated_timeout_ms());
    let bridge_state = app.state::<ScriptResultBridgeState>();

    let result = match command_kind {
        CommandKind::Open => session_runtime::focus_main_window(app).map(|_| {
            json!({
                "address": CONTROL_ADDR,
                "running": true
            })
        }),
        CommandKind::ConversationCreate => {
            session_runtime::create_conversation(app, &bridge_state, timeout)
        }
        CommandKind::SessionEnsure => {
            session_runtime::ensure_session(app, &bridge_state, timeout).map(|state| json!(state))
        }
        CommandKind::Status => match session_runtime::get_shell_state(app, &bridge_state, timeout) {
            Ok(state) => Ok(json!({
                "address": CONTROL_ADDR,
                "running": true,
                "shell": state
            })),
            Err(error) => {
                if error.code == "APP_NOT_READY" {
                    Ok(json!({
                        "address": CONTROL_ADDR,
                        "running": true,
                        "shell": null
                    }))
                } else {
                    Err(error)
                }
            }
        },
        CommandKind::SessionOpen => {
            let session_id = request
                .require_session_id()
                .map_err(|error| error)
                .map(str::to_string);

            session_id.and_then(|session_id| {
                session_runtime::open_session(app, &bridge_state, &session_id, timeout)
                    .map(|state| json!(state))
            })
        }
        CommandKind::CanvasDocumentGet => {
            let session_id = request
                .require_session_id()
                .map_err(|error| error)
                .map(str::to_string);

            session_id.and_then(|session_id| {
                document_bridge::get_document(app, &bridge_state, &session_id, timeout)
            })
        }
        CommandKind::CanvasDocumentApply => {
            let session_id = request
                .require_session_id()
                .map_err(|error| error)
                .map(str::to_string);
            let xml = request
                .payload
                .get("xml")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let base_version = request
                .payload
                .get("baseVersion")
                .and_then(Value::as_str)
                .map(str::to_string);

            session_id.and_then(|session_id| {
                document_bridge::apply_document(
                    app,
                    &bridge_state,
                    &session_id,
                    &xml,
                    base_version.as_deref(),
                    timeout,
                )
            })
        }
    };

    match result {
        Ok(data) => ControlResponse::success(&request, data),
        Err(error) => ControlResponse::error(&request, error),
    }
}

fn read_http_body(stream: &mut TcpStream) -> Result<Vec<u8>, String> {
    let mut reader = BufReader::new(
        stream
            .try_clone()
            .map_err(|error| format!("failed to clone control stream: {error}"))?,
    );
    let mut content_length = 0usize;
    let mut request_line = String::new();

    reader
        .read_line(&mut request_line)
        .map_err(|error| format!("failed to read request line: {error}"))?;

    if request_line.trim().is_empty() {
        return Err("received an empty control request".into());
    }

    loop {
        let mut line = String::new();
        reader
            .read_line(&mut line)
            .map_err(|error| format!("failed to read request headers: {error}"))?;

        if line == "\r\n" || line.is_empty() {
            break;
        }

        if let Some(value) = line.strip_prefix("Content-Length:") {
            content_length = value
                .trim()
                .parse::<usize>()
                .map_err(|error| format!("invalid Content-Length header: {error}"))?;
        }
    }

    let mut body = vec![0u8; content_length];
    reader
        .read_exact(&mut body)
        .map_err(|error| format!("failed to read request body: {error}"))?;

    Ok(body)
}

fn write_http_json_response(
    stream: &mut TcpStream,
    response: &ControlResponse,
) -> Result<(), String> {
    let body = serde_json::to_vec(response).map_err(|error| error.to_string())?;
    let status_line = if response.ok {
        "HTTP/1.1 200 OK"
    } else {
        "HTTP/1.1 400 Bad Request"
    };

    let headers = format!(
        "{status_line}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );

    stream
        .write_all(headers.as_bytes())
        .map_err(|error| format!("failed to write response headers: {error}"))?;
    stream
        .write_all(&body)
        .map_err(|error| format!("failed to write response body: {error}"))?;
    stream
        .flush()
        .map_err(|error| format!("failed to flush response: {error}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::CONTROL_ADDR;

    #[test]
    fn binds_to_loopback_address() {
        assert!(CONTROL_ADDR.starts_with("127.0.0.1:"));
    }
}
