use crate::conversation_db::{self, ConversationDatabase, ConversationRecordRow};
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

pub fn show_main_window(app: &AppHandle) -> Result<(), ControlError> {
    let window = app
        .get_webview_window(crate::webview_api::MAIN_WINDOW_LABEL)
        .ok_or_else(|| ControlError::new("APP_NOT_RUNNING", "main window is not available"))?;

    window
        .show()
        .map_err(|error| ControlError::new("APP_NOT_READY", error.to_string()))?;

    Ok(())
}

pub fn create_conversation(
    app: &AppHandle,
    _bridge_state: &ScriptResultBridgeState,
    _timeout: Duration,
) -> Result<Value, ControlError> {
    show_main_window(app)?;
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

fn find_conversation_by_title(app: &AppHandle, title: &str) -> Result<Option<String>, ControlError> {
    let connection = open_conversation_connection(app)?;
    let summary = conversation_db::find_conversation_by_title(&connection, title)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error))?;

    Ok(summary.map(|item| item.id))
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

fn conversation_to_value(conversation: ConversationRecordRow) -> Value {
    json!({
        "id": conversation.id,
        "title": conversation.title,
        "createdAt": conversation.created_at,
        "updatedAt": conversation.updated_at,
        "messages": conversation.messages.into_iter().map(|message| {
            json!({
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "createdAt": message.created_at
            })
        }).collect::<Vec<_>>(),
        "canvasHistory": conversation.canvas_history.into_iter().map(|entry| {
            let preview_pages = serde_json::from_str::<Value>(&entry.preview_pages_json)
                .unwrap_or_else(|_| Value::Array(Vec::new()));
            json!({
                "id": entry.id,
                "conversationId": entry.conversation_id,
                "createdAt": entry.created_at,
                "label": entry.label,
                "previewPages": preview_pages,
                "source": entry.source,
                "xml": entry.xml,
                "relatedMessageId": entry.related_message_id
            })
        }).collect::<Vec<_>>()
    })
}

pub fn list_sessions(
    app: &AppHandle,
    _bridge_state: &ScriptResultBridgeState,
    _timeout: Duration,
) -> Result<Vec<SessionListEntry>, ControlError> {
    show_main_window(app)?;
    let connection = open_conversation_connection(app)?;

    list_session_entries(&connection)
}

pub fn get_conversation(
    app: &AppHandle,
    _bridge_state: &ScriptResultBridgeState,
    session_id: &str,
    _timeout: Duration,
) -> Result<Value, ControlError> {
    show_main_window(app)?;
    let connection = open_conversation_connection(app)?;
    let conversation = conversation_db::get_conversation_by_id(&connection, session_id)
        .map_err(|error| ControlError::new("INTERNAL_ERROR", error))?
        .ok_or_else(|| {
            ControlError::new(
                "SESSION_NOT_FOUND",
                format!("session '{session_id}' was not found in local storage"),
            )
        })?;

    Ok(conversation_to_value(conversation))
}

pub fn get_conversation_by_title(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    title: &str,
    timeout: Duration,
) -> Result<Value, ControlError> {
    let normalized_title = title.trim();

    if normalized_title.is_empty() {
        return Err(ControlError::new(
            "VALIDATION_FAILED",
            "session title cannot be empty",
        ));
    }

    let session_id = find_conversation_by_title(app, normalized_title)?
        .ok_or_else(|| {
            ControlError::new(
                "SESSION_NOT_FOUND",
                format!("session with title '{normalized_title}' was not found in local storage"),
            )
        })?;

    get_conversation(app, bridge_state, &session_id, timeout)
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

pub fn ensure_session(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    timeout: Duration,
) -> Result<ShellState, ControlError> {
    show_main_window(app)?;

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
    show_main_window(app)?;

    if let Ok(state) = require_session_ready(app, bridge_state, session_id, Duration::from_secs(2))
    {
        return Ok(state);
    }

    if !has_conversation(app, session_id)? {
        return Err(ControlError::new(
            "SESSION_NOT_FOUND",
            format!("session '{session_id}' was not found in local storage"),
        )
        .with_details(Value::String(build_session_route(session_id))));
    }

    navigate_to_session(app, bridge_state, session_id, timeout)?;

    wait_for_session_ready(app, bridge_state, session_id, timeout)
}

pub fn open_session_by_title(
    app: &AppHandle,
    bridge_state: &ScriptResultBridgeState,
    title: &str,
    timeout: Duration,
) -> Result<ShellState, ControlError> {
    show_main_window(app)?;

    let normalized_title = title.trim();

    if normalized_title.is_empty() {
        return Err(ControlError::new(
            "VALIDATION_FAILED",
            "session title cannot be empty",
        ));
    }

    let session_id = find_conversation_by_title(app, normalized_title)?
        .ok_or_else(|| {
            ControlError::new(
                "SESSION_NOT_FOUND",
                format!("session with title '{normalized_title}' was not found in local storage"),
            )
        })?;

    open_session(app, bridge_state, &session_id, timeout)
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

    let fallback_shell_state = get_shell_state(app, bridge_state, Duration::from_secs(2))
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

        if let Ok(state) =
            require_session_ready(app, bridge_state, session_id, Duration::from_secs(2))
        {
            return Ok(state);
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
        is_reusable_session_state, list_session_entries, SessionListEntry,
        SessionRuntimeState, ShellState,
    };
    use crate::conversation_db::{self, ConversationSummaryRow};
    use rusqlite::Connection;

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
