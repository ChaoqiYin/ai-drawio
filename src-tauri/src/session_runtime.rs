use crate::control_protocol::ControlError;
use crate::webview_api::{eval_main_window_script_with_result, ScriptResultBridgeState};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellState {
    #[serde(default)]
    pub bootstrap_error: Option<String>,
    #[serde(default)]
    pub bridge_ready: bool,
    #[serde(default)]
    pub conversation_loaded: bool,
    #[serde(default)]
    pub document_loaded: bool,
    #[serde(default)]
    pub frame_ready: bool,
    #[serde(default)]
    pub last_event: String,
    #[serde(default)]
    pub route: String,
    #[serde(default)]
    pub session_id: String,
}

pub fn build_session_route(session_id: &str) -> String {
    format!("/session?id={session_id}")
}

pub fn extract_session_id_from_route(route: &str) -> Option<String> {
    let query = route.strip_prefix("/session?")?;

    for pair in query.split('&') {
        if let Some(session_id) = pair.strip_prefix("id=") {
            let trimmed = session_id.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    None
}

pub fn get_active_session_id(state: &ShellState) -> Option<String> {
    let trimmed = state.session_id.trim();
    if !trimmed.is_empty() {
        return Some(trimmed.to_string());
    }

    extract_session_id_from_route(&state.route)
}

pub fn is_reusable_session_state(state: &ShellState) -> bool {
    get_active_session_id(state).is_some() && state.bridge_ready && state.frame_ready
}

pub fn focus_main_window(app: &AppHandle) -> Result<(), ControlError> {
    let window = app
        .get_webview_window(crate::webview_api::MAIN_WINDOW_LABEL)
        .ok_or_else(|| ControlError::new("APP_NOT_RUNNING", "main window is not available"))?;

    window
        .show()
        .map_err(|error| ControlError::new("APP_NOT_READY", error.to_string()))?;
    window
        .set_focus()
        .map_err(|error| ControlError::new("APP_NOT_READY", error.to_string()))?;

    Ok(())
}

pub fn create_conversation(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    timeout: Duration,
) -> Result<Value, ControlError> {
    focus_main_window(app)?;

    let started_at = Instant::now();
    let poll_interval = Duration::from_millis(200);

    while started_at.elapsed() < timeout {
        let value = eval_main_window_script_with_result(
            app,
            bridge_state,
            r#"
return await window.__AI_DRAWIO_SHELL__?.conversationStore?.createConversation?.() ?? null;
"#,
            Duration::from_secs(2),
        )
        .map_err(|error| ControlError::new("APP_NOT_READY", error));

        match value {
            Ok(value) if !value.is_null() => return Ok(value),
            Ok(_) | Err(_) => thread::sleep(poll_interval),
        }
    }

    Err(ControlError::new(
        "APP_NOT_READY",
        "timed out while waiting for the conversation create bridge",
    ))
}

fn has_conversation(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
) -> Result<bool, ControlError> {
    let started_at = Instant::now();
    let poll_interval = Duration::from_millis(200);
    let session_id_json = serde_json::to_string(session_id)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error.to_string()))?;

    while started_at.elapsed() < timeout {
        let value = eval_main_window_script_with_result(
            app,
            bridge_state,
            &format!(
                r#"
return await window.__AI_DRAWIO_SHELL__?.conversationStore?.hasConversation?.({session_id_json}) ?? null;
"#
            ),
            Duration::from_secs(2),
        )
        .map_err(|error| ControlError::new("APP_NOT_READY", error));

        match value {
            Ok(Value::Bool(exists)) => return Ok(exists),
            Ok(_) | Err(_) => thread::sleep(poll_interval),
        }
    }

    Err(ControlError::new(
        "APP_NOT_READY",
        "timed out while waiting for the conversation existence bridge",
    ))
}

fn navigate_to_session(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
) -> Result<(), ControlError> {
    let started_at = Instant::now();
    let poll_interval = Duration::from_millis(200);
    let session_id_json = serde_json::to_string(session_id)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error.to_string()))?;

    while started_at.elapsed() < timeout {
        let value = eval_main_window_script_with_result(
            app,
            bridge_state,
            &format!(
                r#"
return await window.__AI_DRAWIO_SHELL__?.conversationStore?.openSession?.({session_id_json}) ?? null;
"#
            ),
            Duration::from_secs(2),
        )
        .map_err(|error| ControlError::new("APP_NOT_READY", error));

        match value {
            Ok(value) if !value.is_null() => return Ok(()),
            Ok(_) | Err(_) => thread::sleep(poll_interval),
        }
    }

    Err(ControlError::new(
        "APP_NOT_READY",
        "timed out while waiting for the session navigation bridge",
    ))
}

pub fn get_shell_state(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    timeout: Duration,
) -> Result<ShellState, ControlError> {
    let value = eval_main_window_script_with_result(
        app,
        bridge_state,
        r#"
return window.__AI_DRAWIO_SHELL__?.getState?.() ?? null;
"#,
        timeout,
    )
    .map_err(|error| ControlError::new("APP_NOT_READY", error))?;

    if value.is_null() {
        return Err(ControlError::new(
            "APP_NOT_READY",
            "shell bridge is not available on the current page",
        ));
    }

    serde_json::from_value(value)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error.to_string()))
}

pub fn ensure_session(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    timeout: Duration,
) -> Result<ShellState, ControlError> {
    focus_main_window(app)?;

    if let Ok(state) = get_shell_state(app, bridge_state, Duration::from_secs(2)) {
        if is_reusable_session_state(&state) {
            return Ok(state);
        }

        if let Some(session_id) = get_active_session_id(&state) {
            return wait_for_session_ready(app, bridge_state, &session_id, timeout);
        }
    }

    let created_conversation = create_conversation(app, bridge_state, timeout)?;
    let session_id = created_conversation
        .get("id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| {
            ControlError::new(
                "INTERNAL_ERROR",
                "conversation create bridge did not return a persisted session id",
            )
        })?;

    open_session(app, bridge_state, &session_id, timeout)
}

pub fn open_session(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
) -> Result<ShellState, ControlError> {
    focus_main_window(app)?;

    if let Ok(state) = get_shell_state(app, bridge_state, Duration::from_secs(2)) {
        if get_active_session_id(&state).as_deref() == Some(session_id) && is_reusable_session_state(&state) {
            return Ok(state);
        }
    }

    if !has_conversation(app, bridge_state, session_id, timeout)? {
        return Err(ControlError::new(
            "SESSION_NOT_FOUND",
            format!("session '{session_id}' was not found in local storage"),
        )
        .with_details(Value::String(build_session_route(session_id))));
    }

    navigate_to_session(app, bridge_state, session_id, timeout)?;

    wait_for_session_ready(app, bridge_state, session_id, timeout)
}

pub fn require_active_session(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
) -> Result<ShellState, ControlError> {
    let state = get_shell_state(app, bridge_state, timeout)?;

    if state.session_id != session_id {
        return Err(ControlError::new(
            "SESSION_NOT_OPEN",
            format!("active session is '{}'", state.session_id),
        )
        .with_details(json!({
            "activeSessionId": state.session_id,
            "requestedSessionId": session_id
        })));
    }

    if !state.bridge_ready || !state.frame_ready {
        return Err(ControlError::new(
            "FRAME_NOT_READY",
            "draw.io iframe bridge is not ready",
        )
        .with_details(json!({
            "bridgeReady": state.bridge_ready,
            "frameReady": state.frame_ready
        })));
    }

    Ok(state)
}

fn wait_for_session_ready(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
) -> Result<ShellState, ControlError> {
    let started_at = Instant::now();
    let poll_interval = Duration::from_millis(200);

    while started_at.elapsed() < timeout {
        if let Ok(state) = get_shell_state(app, bridge_state, Duration::from_secs(2)) {
            if get_active_session_id(&state).as_deref() == Some(session_id)
                && state.bridge_ready
                && state.frame_ready
            {
                return Ok(state);
            }
        }

        thread::sleep(poll_interval);
    }

    Err(ControlError::new(
        "COMMAND_TIMEOUT",
        format!("timed out while opening session '{session_id}'"),
    )
    .with_details(Value::String(build_session_route(session_id))))
}

#[cfg(test)]
mod tests {
    use super::{
        build_session_route, extract_session_id_from_route, get_active_session_id,
        is_reusable_session_state, ShellState,
    };

    #[test]
    fn builds_session_route() {
        assert_eq!(build_session_route("sess-1"), "/session?id=sess-1");
    }

    #[test]
    fn extracts_session_id_from_session_route() {
        assert_eq!(
            extract_session_id_from_route("/session?id=sess-1&foo=bar").as_deref(),
            Some("sess-1")
        );
    }

    #[test]
    fn prefers_shell_state_session_id_when_available() {
        let state = ShellState {
            bootstrap_error: None,
            bridge_ready: false,
            conversation_loaded: false,
            document_loaded: false,
            frame_ready: false,
            last_event: "idle".to_string(),
            route: "/session?id=from-route".to_string(),
            session_id: "from-state".to_string(),
        };

        assert_eq!(get_active_session_id(&state).as_deref(), Some("from-state"));
    }

    #[test]
    fn reuses_ready_session_route() {
        let state = ShellState {
            bootstrap_error: None,
            bridge_ready: true,
            conversation_loaded: true,
            document_loaded: true,
            frame_ready: true,
            last_event: "ready".to_string(),
            route: "/session?id=sess-1".to_string(),
            session_id: "sess-1".to_string(),
        };

        assert!(is_reusable_session_state(&state));
    }
}
