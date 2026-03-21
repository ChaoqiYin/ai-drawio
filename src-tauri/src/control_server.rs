use crate::control_protocol::{CommandKind, ControlError, ControlRequest, ControlResponse};
use crate::document_bridge;
use crate::session_runtime;
use crate::webview_api::{eval_main_window_script_with_result, ScriptResultBridgeState};
use serde_json::{json, Value};
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpListener;
#[cfg(unix)]
use std::os::unix::net::UnixListener;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager};

pub const CONTROL_ADDR: &str = "127.0.0.1:47831";
#[cfg(unix)]
pub const CONTROL_SOCKET_FILE_NAME: &str = "ai-drawio-control.sock";

pub fn start_control_server(app: AppHandle) -> Result<(), String> {
    let listener = TcpListener::bind(CONTROL_ADDR).map_err(|error| error.to_string())?;
    spawn_tcp_control_server(app.clone(), listener);

    #[cfg(unix)]
    {
        let socket_path = control_socket_path();
        remove_stale_control_socket(&socket_path)?;
        let listener = UnixListener::bind(&socket_path).map_err(|error| error.to_string())?;
        spawn_unix_control_server(app, listener);
    }

    Ok(())
}

#[cfg(unix)]
pub fn control_socket_path() -> PathBuf {
    std::env::temp_dir().join(CONTROL_SOCKET_FILE_NAME)
}

fn spawn_tcp_control_server(app: AppHandle, listener: TcpListener) {
    thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else {
                continue;
            };

            let app_handle = app.clone();
            thread::spawn(move || {
                if let Err(error) = handle_stream(app_handle, stream) {
                    eprintln!("control server tcp error: {error}");
                }
            });
        }
    });
}

#[cfg(unix)]
fn spawn_unix_control_server(app: AppHandle, listener: UnixListener) {
    thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(stream) = stream else {
                continue;
            };

            let app_handle = app.clone();
            thread::spawn(move || {
                if let Err(error) = handle_stream(app_handle, stream) {
                    eprintln!("control server unix error: {error}");
                }
            });
        }
    });
}

#[cfg(unix)]
fn remove_stale_control_socket(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "failed to remove stale control socket '{}': {error}",
            path.display()
        )),
    }
}

fn handle_stream<S>(app: AppHandle, mut stream: S) -> Result<(), String>
where
    S: Read + Write,
{
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
        CommandKind::ConversationCreate => {
            session_runtime::create_conversation(app, &bridge_state, timeout)
        }
        CommandKind::Status => {
            build_status_payload(app, &bridge_state, &request, timeout)
        }
        CommandKind::SessionOpen => {
            let activate = request
                .payload
                .get("activate")
                .and_then(Value::as_bool)
                .unwrap_or(true);
            let session_id = request
                .require_session_id()
                .map_err(|error| error)
                .map(str::to_string);

            session_id.and_then(|session_id| {
                session_runtime::open_session(app, &bridge_state, &session_id, timeout, activate)
                    .map(|state| json!(state))
            })
        }
        CommandKind::SessionList => session_runtime::list_sessions(app, &bridge_state, timeout)
            .map(|sessions| {
                json!({
                    "sessions": sessions
                })
            }),
        CommandKind::CanvasDocumentGet => {
            let session_id = request
                .require_session_id()
                .map_err(|error| error)
                .map(str::to_string);

            session_id.and_then(|session_id| {
                document_bridge::get_document(app, &bridge_state, &session_id, timeout)
            })
        }
        CommandKind::CanvasDocumentSvg => {
            let session_id = request
                .require_session_id()
                .map_err(|error| error)
                .map(str::to_string);

            session_id.and_then(|session_id| {
                document_bridge::export_svg_pages(app, &bridge_state, &session_id, timeout)
            })
        }
        CommandKind::CanvasDocumentPreview => {
            let session_id = request
                .require_session_id()
                .map_err(|error| error)
                .map(str::to_string);
            let page = request.payload.get("page").and_then(Value::as_u64);

            session_id.and_then(|session_id| {
                document_bridge::export_preview_pages(
                    app,
                    &bridge_state,
                    &session_id,
                    page,
                    timeout,
                )
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
            let prompt = request
                .payload
                .get("prompt")
                .and_then(Value::as_str)
                .map(str::to_string);

            session_id.and_then(|session_id| {
                document_bridge::apply_document(
                    app,
                    &bridge_state,
                    &session_id,
                    &xml,
                    base_version.as_deref(),
                    prompt.as_deref(),
                    timeout,
                )
            })
        }
        CommandKind::CanvasDocumentRestore => {
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
                document_bridge::apply_document_without_history(
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

fn build_status_payload(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    request: &ControlRequest,
    timeout: Duration,
) -> Result<Value, ControlError> {
    let (shell, shell_error) = match session_runtime::get_shell_state(app, bridge_state, timeout) {
        Ok(state) => (Some(json!(state)), Value::Null),
        Err(error) => {
            if error.code == "APP_NOT_READY" {
                (None, json!({
                    "code": error.code,
                    "message": error.message
                }))
            } else {
                return Err(error);
            }
        }
    };

    let session = request
        .session_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|session_id| build_status_session_payload(app, bridge_state, session_id, timeout))
        .transpose()?;
    let (page, page_error) = match build_page_debug_payload(app, bridge_state, timeout) {
        Ok(payload) => (payload, Value::Null),
        Err(message) => (
            Value::Null,
            json!({
                "code": "APP_NOT_READY",
                "message": message
            }),
        ),
    };

    Ok(json!({
        "address": CONTROL_ADDR,
        "socketPath": control_socket_path_json_value(),
        "page": page,
        "pageError": page_error,
        "running": true,
        "session": session,
        "shell": shell,
        "shellError": shell_error
    }))
}

fn build_page_debug_payload(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    timeout: Duration,
) -> Result<Value, String> {
    eval_main_window_script_with_result(
        app,
        bridge_state,
        r#"
return {
  bodyText: typeof document.body?.innerText === "string" ? document.body.innerText.slice(0, 200) : "",
  hasShell: Boolean(window.__AI_DRAWIO_SHELL__),
  readyState: document.readyState,
  route: `${window.location.pathname}${window.location.search}`,
  shellKeys: Object.keys(window.__AI_DRAWIO_SHELL__ ?? {}),
  title: document.title
};
"#,
        timeout,
    )
}

fn build_status_session_payload(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
) -> Result<Value, ControlError> {
    match session_runtime::get_session_runtime_state(app, bridge_state, session_id, timeout) {
        Ok(state) => Ok(json!(state)),
        Err(error) if error.code == "SESSION_NOT_READY" => Ok(json!({
            "isReady": false,
            "sessionId": session_id,
            "status": "unregistered"
        })),
        Err(error) if error.code == "APP_NOT_READY" => Ok(json!({
            "isReady": false,
            "sessionId": session_id,
            "status": "unavailable"
        })),
        Err(error) => Err(error),
    }
}

fn control_socket_path_json_value() -> Value {
    #[cfg(unix)]
    {
        return Value::String(control_socket_path().display().to_string());
    }

    #[cfg(not(unix))]
    {
        Value::Null
    }
}

fn read_http_body<S>(stream: &mut S) -> Result<Vec<u8>, String>
where
    S: Read,
{
    let mut reader = BufReader::new(stream);
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

fn write_http_json_response<S>(stream: &mut S, response: &ControlResponse) -> Result<(), String>
where
    S: Write,
{
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
    #[cfg(unix)]
    use super::{control_socket_path, CONTROL_SOCKET_FILE_NAME};

    #[test]
    fn binds_to_loopback_address() {
        assert!(CONTROL_ADDR.starts_with("127.0.0.1:"));
    }

    #[cfg(unix)]
    #[test]
    fn control_socket_path_is_stored_in_the_temp_directory() {
        let path = control_socket_path();

        assert!(path.starts_with(std::env::temp_dir()));
        assert_eq!(path.file_name().and_then(|value| value.to_str()), Some(CONTROL_SOCKET_FILE_NAME));
    }
}
