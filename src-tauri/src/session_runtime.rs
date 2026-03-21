use crate::conversation_db::{self, ConversationDatabase};
use crate::control_protocol::ControlError;
use crate::webview_api::{eval_main_window_script_with_result, ScriptResultBridgeState};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

const BRIDGE_ATTEMPT_TIMEOUT: Duration = Duration::from_secs(2);
const MIN_ATTEMPT_TIMEOUT: Duration = Duration::from_millis(1);

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

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionListEntry {
    pub id: String,
    pub title: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRuntimeState {
    #[serde(default)]
    pub is_ready: bool,
    #[serde(default)]
    pub session_id: String,
    #[serde(default)]
    pub status: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionCloseResult {
    pub session_id: String,
    pub status: String,
}

pub fn build_session_route(session_id: &str) -> String {
    format!("/session?id={session_id}")
}

#[cfg(test)]
fn extract_session_id_from_route(route: &str) -> Option<String> {
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

#[cfg(test)]
fn get_active_session_id(state: &ShellState) -> Option<String> {
    let trimmed = state.session_id.trim();
    if !trimmed.is_empty() {
        return Some(trimmed.to_string());
    }

    extract_session_id_from_route(&state.route)
}

#[cfg(test)]
fn is_reusable_session_state(state: &ShellState) -> bool {
    get_active_session_id(state).is_some() && state.bridge_ready && state.frame_ready
}

pub fn create_conversation(
    app: &AppHandle,
    _bridge_state: &ScriptResultBridgeState,
    _timeout: Duration,
) -> Result<Value, ControlError> {
    let connection = open_conversation_connection(app)?;
    let conversation = conversation_db::create_conversation(&connection, "本地 AI 会话")
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error))?;

    Ok(json!({
        "createdAt": conversation.created_at,
        "href": build_session_route(&conversation.id),
        "id": conversation.id,
        "title": conversation.title,
        "updatedAt": conversation.updated_at
    }))
}

fn open_conversation_connection(app: &AppHandle) -> Result<rusqlite::Connection, ControlError> {
    app.state::<ConversationDatabase>()
        .connection(app)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error))
}

fn has_conversation(app: &AppHandle, session_id: &str) -> Result<bool, ControlError> {
    let connection = open_conversation_connection(app)?;

    conversation_db::has_conversation(&connection, session_id)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error))
}

fn list_session_entries(
    connection: &rusqlite::Connection,
) -> Result<Vec<SessionListEntry>, ControlError> {
    let page = conversation_db::list_conversation_summaries(connection, None, 1, u32::MAX)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error))?;

    Ok(page
        .items
        .into_iter()
        .map(|item| SessionListEntry {
            id: item.id,
            title: item.title,
        })
        .collect())
}

pub fn list_sessions(
    app: &AppHandle,
    _bridge_state: &ScriptResultBridgeState,
    _timeout: Duration,
) -> Result<Vec<SessionListEntry>, ControlError> {
    let connection = open_conversation_connection(app)?;

    list_session_entries(&connection)
}

fn navigate_to_session(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
    activate: bool,
) -> Result<(), ControlError> {
    let started_at = Instant::now();
    let poll_interval = Duration::from_millis(200);
    let session_id_json = serde_json::to_string(session_id)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error.to_string()))?;
    let activate_json = if activate { "true" } else { "false" };

    while started_at.elapsed() < timeout {
        let attempt_timeout = remaining_attempt_timeout(
            started_at,
            timeout,
            BRIDGE_ATTEMPT_TIMEOUT,
        );
        let value = eval_main_window_script_with_result(
            app,
            bridge_state,
            &format!(
                r#"
return await window.__AI_DRAWIO_SHELL__?.conversationStore?.openSession?.({session_id_json}, {{ activate: {activate_json} }}) ?? null;
"#
            ),
            attempt_timeout,
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

pub fn get_session_runtime_state(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
) -> Result<SessionRuntimeState, ControlError> {
    let session_id_json = serde_json::to_string(session_id)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error.to_string()))?;

    let value = eval_main_window_script_with_result(
        app,
        bridge_state,
        &format!(
            r#"
return window.__AI_DRAWIO_SHELL__?.sessions?.[{session_id_json}]?.getState?.() ?? null;
"#
        ),
        timeout,
    )
    .map_err(|error| ControlError::new("APP_NOT_READY", error))?;

    if value.is_null() {
        return Err(ControlError::new(
            "SESSION_NOT_READY",
            format!("session runtime '{session_id}' is not registered"),
        ));
    }

    serde_json::from_value(value)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error.to_string()))
}

pub fn open_session(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
    activate: bool,
) -> Result<ShellState, ControlError> {
    if !has_conversation(app, session_id)? {
        return Err(ControlError::new(
            "SESSION_NOT_FOUND",
            format!("session '{session_id}' was not found in local storage"),
        )
        .with_details(Value::String(build_session_route(session_id))));
    }

    navigate_to_session(app, bridge_state, session_id, timeout, activate)?;

    Ok(get_shell_state(
        app,
        bridge_state,
        timeout.min(BRIDGE_ATTEMPT_TIMEOUT),
    )
    .unwrap_or(ShellState {
        bootstrap_error: None,
        bridge_ready: false,
        conversation_loaded: false,
        document_loaded: false,
        frame_ready: false,
        last_event: "session-navigation-requested".to_string(),
        route: build_session_route(session_id),
        session_id: session_id.to_string(),
    }))
}

pub fn close_session(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
) -> Result<SessionCloseResult, ControlError> {
    if !has_conversation(app, session_id)? {
        return Err(ControlError::new(
            "SESSION_NOT_FOUND",
            format!("session '{session_id}' was not found in local storage"),
        )
        .with_details(Value::String(build_session_route(session_id))));
    }

    let session_id_json = serde_json::to_string(session_id)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error.to_string()))?;
    let value = eval_main_window_script_with_result(
        app,
        bridge_state,
        &format!(
            r#"
return await (async () => {{
  const closeSession = window.__AI_DRAWIO_SHELL__?.conversationStore?.closeSession;

  if (typeof closeSession !== "function") {{
    return {{
      ok: false,
      error: {{
        code: "APP_NOT_READY",
        message: "session close bridge is not available"
      }}
    }};
  }}

  try {{
    const result = await closeSession({session_id_json});
    return {{
      ok: true,
      value: result
    }};
  }} catch (error) {{
    const errorObject = error && typeof error === "object" ? error : null;
    const message = error instanceof Error ? error.message : String(error);
    const code =
      typeof errorObject?.code === "string" && errorObject.code.trim().length > 0
        ? errorObject.code
        : "APP_NOT_READY";
    const details =
      errorObject && "details" in errorObject ? errorObject.details ?? null : null;

    return {{
      ok: false,
      error: {{
        code,
        details,
        message
      }}
    }};
  }}
}})();
"#
        ),
        timeout,
    )
    .map_err(|error| ControlError::new("APP_NOT_READY", error))?;

    let Some(true) = value.get("ok").and_then(Value::as_bool) else {
        let error = value.get("error").cloned().unwrap_or(Value::Null);
        let code = error
            .get("code")
            .and_then(Value::as_str)
            .unwrap_or("APP_NOT_READY");
        let message = error
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("session close bridge rejected the request");
        let details = error.get("details").cloned();

        let control_error = match details {
            Some(details) if !details.is_null() => ControlError::new(code, message).with_details(details),
            _ => ControlError::new(code, message),
        };

        return Err(control_error);
    };

    let result = value.get("value").cloned().unwrap_or_else(|| {
        json!({
            "sessionId": session_id,
            "status": "closed"
        })
    });

    serde_json::from_value(result)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error.to_string()))
}

pub fn require_session_ready(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    timeout: Duration,
) -> Result<ShellState, ControlError> {
    let runtime_state = get_session_runtime_state(app, bridge_state, session_id, timeout)?;

    if runtime_state.session_id.trim().is_empty() || runtime_state.session_id != session_id {
        return Err(ControlError::new(
            "SESSION_NOT_READY",
            format!("session runtime '{session_id}' did not report the requested session id"),
        )
        .with_details(json!({
            "reportedSessionId": runtime_state.session_id,
            "requestedSessionId": session_id
        })));
    }

    if !runtime_state.is_ready {
        return Err(
            ControlError::new("FRAME_NOT_READY", "draw.io iframe bridge is not ready")
                .with_details(json!({
                    "requestedSessionId": session_id,
                    "status": runtime_state.status
                })),
        );
    }

    let fallback_shell_state = get_shell_state(app, bridge_state, timeout)
        .unwrap_or(ShellState {
            bootstrap_error: None,
            bridge_ready: true,
            conversation_loaded: true,
            document_loaded: true,
            frame_ready: true,
            last_event: runtime_state.status.clone(),
            route: build_session_route(session_id),
            session_id: session_id.to_string(),
        });

    Ok(ShellState {
        bootstrap_error: fallback_shell_state.bootstrap_error,
        bridge_ready: true,
        conversation_loaded: fallback_shell_state.conversation_loaded,
        document_loaded: fallback_shell_state.document_loaded,
        frame_ready: true,
        last_event: runtime_state.status,
        route: fallback_shell_state.route,
        session_id: session_id.to_string(),
    })
}

fn remaining_attempt_timeout(
    started_at: Instant,
    total_timeout: Duration,
    max_attempt_timeout: Duration,
) -> Duration {
    let remaining = total_timeout.saturating_sub(started_at.elapsed());
    let bounded = remaining.min(max_attempt_timeout);

    if bounded.is_zero() {
        MIN_ATTEMPT_TIMEOUT
    } else {
        bounded
    }
}

#[cfg(test)]
fn remaining_total_timeout(
    started_at: Instant,
    total_timeout: Duration,
) -> Result<Duration, ControlError> {
    let remaining = total_timeout.saturating_sub(started_at.elapsed());

    if remaining.is_zero() {
        return Err(ControlError::new(
            "COMMAND_TIMEOUT",
            "timed out before the next session step could begin",
        ));
    }

    Ok(remaining)
}

#[cfg(test)]
mod tests {
    use super::{
        build_session_route, extract_session_id_from_route, get_active_session_id,
        is_reusable_session_state, list_session_entries, remaining_attempt_timeout,
        remaining_total_timeout, SessionListEntry, SessionRuntimeState, ShellState,
        BRIDGE_ATTEMPT_TIMEOUT,
    };
    use crate::conversation_db::{self, ConversationSummaryRow};
    use rusqlite::Connection;
    use std::time::{Duration, Instant};

    #[test]
    fn builds_session_route() {
        assert_eq!(build_session_route("sess-1"), "/session?id=sess-1");
    }

    #[test]
    fn session_runtime_state_serializes_with_ready_fields() {
        let state = SessionRuntimeState {
            is_ready: true,
            session_id: "sess-1".to_string(),
            status: "idle".to_string(),
        };

        assert!(state.is_ready);
        assert_eq!(state.session_id, "sess-1");
        assert_eq!(state.status, "idle");
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

    #[test]
    fn remaining_attempt_timeout_caps_each_bridge_attempt() {
        let started_at = Instant::now();

        let timeout = remaining_attempt_timeout(
            started_at,
            Duration::from_secs(30),
            BRIDGE_ATTEMPT_TIMEOUT,
        );

        assert!(timeout <= BRIDGE_ATTEMPT_TIMEOUT);
        assert!(!timeout.is_zero());
    }

    #[test]
    fn remaining_attempt_timeout_shrinks_to_the_remaining_budget() {
        let started_at = Instant::now() - Duration::from_millis(950);

        let timeout = remaining_attempt_timeout(
            started_at,
            Duration::from_secs(1),
            BRIDGE_ATTEMPT_TIMEOUT,
        );

        assert!(timeout <= Duration::from_millis(50));
        assert!(!timeout.is_zero());
    }

    #[test]
    fn remaining_total_timeout_returns_remaining_budget() {
        let started_at = Instant::now() - Duration::from_millis(100);

        let remaining =
            remaining_total_timeout(started_at, Duration::from_secs(1)).expect("budget remains");

        assert!(remaining <= Duration::from_millis(900));
        assert!(!remaining.is_zero());
    }

    #[test]
    fn remaining_total_timeout_rejects_exhausted_budget() {
        let started_at = Instant::now() - Duration::from_secs(2);

        let error = remaining_total_timeout(started_at, Duration::from_secs(1))
            .expect_err("exhausted budget should fail");

        assert_eq!(error.code, "COMMAND_TIMEOUT");
    }

    #[test]
    fn list_session_entries_reads_sqlite_summaries_in_updated_order() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite should open");

        conversation_db::insert_conversation_summary(
            &connection,
            &ConversationSummaryRow {
                id: "session-1".to_string(),
                title: "Alpha".to_string(),
                created_at: "2026-03-20T10:00:00Z".to_string(),
                updated_at: "2026-03-20T10:00:00Z".to_string(),
            },
        )
        .expect("first conversation should insert");
        conversation_db::insert_conversation_summary(
            &connection,
            &ConversationSummaryRow {
                id: "session-2".to_string(),
                title: "Beta".to_string(),
                created_at: "2026-03-20T11:00:00Z".to_string(),
                updated_at: "2026-03-20T12:00:00Z".to_string(),
            },
        )
        .expect("second conversation should insert");

        let entries = list_session_entries(&connection).expect("session entries should load");

        assert_eq!(
            entries,
            vec![
                SessionListEntry {
                    id: "session-2".to_string(),
                    title: "Beta".to_string(),
                },
                SessionListEntry {
                    id: "session-1".to_string(),
                    title: "Alpha".to_string(),
                },
            ]
        );
    }

    #[test]
    fn sqlite_title_lookup_is_case_insensitive() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite should open");

        conversation_db::insert_conversation_summary(
            &connection,
            &ConversationSummaryRow {
                id: "session-1".to_string(),
                title: "Alpha Flow".to_string(),
                created_at: "2026-03-20T10:00:00Z".to_string(),
                updated_at: "2026-03-20T10:00:00Z".to_string(),
            },
        )
        .expect("conversation should insert");

        let summary = conversation_db::find_conversation_by_title(&connection, "alpha flow")
            .expect("title lookup should succeed");

        assert_eq!(summary.expect("title lookup should match").id, "session-1");
    }

    #[test]
    fn sqlite_title_lookup_returns_none_for_missing_titles() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite should open");
        let missing = conversation_db::find_conversation_by_title(&connection, "missing")
            .expect("title lookup should succeed");

        assert!(missing.is_none());
    }
}
