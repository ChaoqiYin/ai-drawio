use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use tauri::Manager;
use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ConversationSummaryRow {
    pub created_at: String,
    pub id: String,
    pub title: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ConversationSummaryPage {
    pub items: Vec<ConversationSummaryRow>,
    pub page: u32,
    pub page_size: u32,
    pub total: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ConversationMessageRow {
    pub content: String,
    pub created_at: String,
    pub id: String,
    pub role: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CanvasHistoryRow {
    pub conversation_id: String,
    pub created_at: String,
    pub id: String,
    pub label: String,
    pub preview_pages_json: String,
    pub related_message_id: Option<String>,
    pub source: String,
    pub xml: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ConversationRecordRow {
    pub canvas_history: Vec<CanvasHistoryRow>,
    pub created_at: String,
    pub id: String,
    pub messages: Vec<ConversationMessageRow>,
    pub title: String,
    pub updated_at: String,
}

static NEXT_IDENTIFIER: AtomicU64 = AtomicU64::new(1);
const DEFAULT_CONVERSATION_TITLE: &str = "Untitled AI Session";
const WELCOME_MESSAGE_CONTENT: &str =
    "Start a new local AI conversation and then open the diagram workspace.";
const INITIAL_CANVAS_LABEL: &str = "Initial Blank Canvas";
const INITIAL_CANVAS_XML: &str =
    "<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/></root></mxGraphModel>";
const EMPTY_PREVIEW_PAGES_JSON: &str = "[]";

pub struct ConversationDatabase {
    path: Mutex<Option<PathBuf>>,
}

impl ConversationDatabase {
    pub fn new() -> Self {
        Self {
            path: Mutex::new(None),
        }
    }

    pub fn database_path(&self, app: &tauri::AppHandle) -> Result<PathBuf, String> {
        let mut guard = self
            .path
            .lock()
            .map_err(|_| "failed to lock conversation database state".to_string())?;

        if let Some(path) = guard.as_ref() {
            return Ok(path.clone());
        }

        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        std::fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;

        let path = app_data_dir.join("conversations.sqlite3");
        *guard = Some(path.clone());

        Ok(path)
    }

    pub fn connection(&self, app: &tauri::AppHandle) -> Result<Connection, String> {
        let path = self.database_path(app)?;
        let connection = Connection::open(path).map_err(|error| error.to_string())?;

        initialize_schema(&connection).map_err(|error| error.to_string())?;

        Ok(connection)
    }
}

impl Default for ConversationDatabase {
    fn default() -> Self {
        Self::new()
    }
}

fn normalize_title(value: &str) -> String {
    value.trim().to_lowercase()
}

fn next_identifier(prefix: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let counter = NEXT_IDENTIFIER.fetch_add(1, Ordering::Relaxed);

    format!("{prefix}-{timestamp}-{counter}")
}

fn current_timestamp() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| error.to_string())
}

fn initialize_schema(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            normalized_title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS canvas_history (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            label TEXT NOT NULL,
            preview_pages_json TEXT NOT NULL,
            source TEXT NOT NULL,
            xml TEXT NOT NULL,
            related_message_id TEXT
        );

        CREATE INDEX IF NOT EXISTS conversations_updated_at_idx
            ON conversations(updated_at DESC, id);
        CREATE INDEX IF NOT EXISTS conversations_normalized_title_idx
            ON conversations(normalized_title);
        CREATE INDEX IF NOT EXISTS messages_conversation_id_idx
            ON messages(conversation_id, created_at);
        CREATE INDEX IF NOT EXISTS canvas_history_conversation_id_idx
            ON canvas_history(conversation_id, created_at);
        ",
    )?;

    Ok(())
}

pub fn insert_conversation_summary(
    connection: &Connection,
    summary: &ConversationSummaryRow,
) -> Result<(), String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    connection
        .execute(
            "
            INSERT OR REPLACE INTO conversations (id, title, normalized_title, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ",
            params![
                summary.id,
                summary.title,
                normalize_title(&summary.title),
                summary.created_at,
                summary.updated_at
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn insert_message(
    connection: &Connection,
    conversation_id: &str,
    id: &str,
    role: &str,
    content: &str,
    created_at: &str,
) -> Result<(), String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    connection
        .execute(
            "
            INSERT OR REPLACE INTO messages (id, conversation_id, role, content, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ",
            params![id, conversation_id, role, content, created_at],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn insert_canvas_history_entry(
    connection: &Connection,
    conversation_id: &str,
    id: &str,
    created_at: &str,
    label: &str,
    preview_pages_json: &str,
    source: &str,
    xml: &str,
    related_message_id: Option<&str>,
) -> Result<(), String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    connection
        .execute(
            "
            INSERT OR REPLACE INTO canvas_history (
                id,
                conversation_id,
                created_at,
                label,
                preview_pages_json,
                source,
                xml,
                related_message_id
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ",
            params![
                id,
                conversation_id,
                created_at,
                label,
                preview_pages_json,
                source,
                xml,
                related_message_id
            ],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn has_conversation(connection: &Connection, id: &str) -> Result<bool, String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    let exists: Option<String> = connection
        .query_row(
            "SELECT id FROM conversations WHERE id = ?1 LIMIT 1",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    Ok(exists.is_some())
}

pub fn get_conversation_by_id(
    connection: &Connection,
    id: &str,
) -> Result<Option<ConversationRecordRow>, String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    let summary = connection
        .query_row(
            "
            SELECT id, title, created_at, updated_at
            FROM conversations
            WHERE id = ?1
            ",
            params![id],
            |row| {
                Ok(ConversationSummaryRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some(summary) = summary else {
        return Ok(None);
    };

    let messages = list_conversation_messages(connection, &summary.id)?;
    let canvas_history = list_canvas_history(connection, &summary.id)?;

    Ok(Some(ConversationRecordRow {
        canvas_history,
        created_at: summary.created_at,
        id: summary.id,
        messages,
        title: summary.title,
        updated_at: summary.updated_at,
    }))
}

#[cfg(test)]
pub fn find_conversation_by_title(
    connection: &Connection,
    title: &str,
) -> Result<Option<ConversationSummaryRow>, String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    let normalized_title = normalize_title(title);

    if normalized_title.is_empty() {
        return Ok(None);
    }

    connection
        .query_row(
            "
            SELECT id, title, created_at, updated_at
            FROM conversations
            WHERE normalized_title = ?1
            ORDER BY updated_at DESC, id ASC
            LIMIT 1
            ",
            params![normalized_title],
            |row| {
                Ok(ConversationSummaryRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())
}

fn list_conversation_messages(
    connection: &Connection,
    conversation_id: &str,
) -> Result<Vec<ConversationMessageRow>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT id, role, content, created_at
            FROM messages
            WHERE conversation_id = ?1
            ORDER BY created_at ASC, id ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![conversation_id], |row| {
            Ok(ConversationMessageRow {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut items = Vec::new();

    for row in rows {
        items.push(row.map_err(|error| error.to_string())?);
    }

    Ok(items)
}

fn list_canvas_history(
    connection: &Connection,
    conversation_id: &str,
) -> Result<Vec<CanvasHistoryRow>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT id, conversation_id, created_at, label, preview_pages_json, source, xml, related_message_id
            FROM canvas_history
            WHERE conversation_id = ?1
            ORDER BY created_at ASC, id ASC
            ",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![conversation_id], |row| {
            Ok(CanvasHistoryRow {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                created_at: row.get(2)?,
                label: row.get(3)?,
                preview_pages_json: row.get(4)?,
                source: row.get(5)?,
                xml: row.get(6)?,
                related_message_id: row.get(7)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut items = Vec::new();

    for row in rows {
        items.push(row.map_err(|error| error.to_string())?);
    }

    Ok(items)
}

fn next_conversation_title(connection: &Connection, base_title: &str) -> Result<String, String> {
    let normalized_base = if base_title.trim().is_empty() {
        DEFAULT_CONVERSATION_TITLE
    } else {
        base_title.trim()
    };
    let mut statement = connection
        .prepare("SELECT title FROM conversations")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|error| error.to_string())?;
    let mut highest_index = 0u32;

    for row in rows {
        let title = row.map_err(|error| error.to_string())?;

        if title == normalized_base {
            highest_index = highest_index.max(1);
            continue;
        }

        let Some(suffix) = title.strip_prefix(&format!("{normalized_base} ")) else {
            continue;
        };
        let Ok(index) = suffix.parse::<u32>() else {
            continue;
        };

        highest_index = highest_index.max(index);
    }

    if highest_index == 0 {
        return Ok(format!("{normalized_base} 1"));
    }

    Ok(format!("{normalized_base} {}", highest_index + 1))
}

pub fn create_conversation(connection: &Connection, title: &str) -> Result<ConversationRecordRow, String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    let now = current_timestamp()?;
    let conversation_id = next_identifier("conversation");
    let message_id = next_identifier("message");
    let canvas_history_id = next_identifier("canvas-history");
    let next_title = next_conversation_title(connection, title)?;
    let summary = ConversationSummaryRow {
        id: conversation_id.clone(),
        title: next_title,
        created_at: now.clone(),
        updated_at: now.clone(),
    };
    let message = ConversationMessageRow {
        id: message_id.clone(),
        role: "assistant".to_string(),
        content: WELCOME_MESSAGE_CONTENT.to_string(),
        created_at: now.clone(),
    };
    let canvas_history_entry = CanvasHistoryRow {
        id: canvas_history_id,
        conversation_id: conversation_id.clone(),
        created_at: now.clone(),
        label: INITIAL_CANVAS_LABEL.to_string(),
        preview_pages_json: EMPTY_PREVIEW_PAGES_JSON.to_string(),
        related_message_id: Some(message_id),
        source: "ai-pre-apply".to_string(),
        xml: INITIAL_CANVAS_XML.to_string(),
    };

    let transaction = connection.unchecked_transaction().map_err(|error| error.to_string())?;
    insert_conversation_summary(&transaction, &summary)?;
    insert_message(
        &transaction,
        &conversation_id,
        &message.id,
        &message.role,
        &message.content,
        &message.created_at,
    )?;
    insert_canvas_history_entry(
        &transaction,
        &conversation_id,
        &canvas_history_entry.id,
        &canvas_history_entry.created_at,
        &canvas_history_entry.label,
        &canvas_history_entry.preview_pages_json,
        &canvas_history_entry.source,
        &canvas_history_entry.xml,
        canvas_history_entry.related_message_id.as_deref(),
    )?;
    transaction.commit().map_err(|error| error.to_string())?;

    Ok(ConversationRecordRow {
        canvas_history: vec![canvas_history_entry],
        created_at: summary.created_at,
        id: summary.id,
        messages: vec![message],
        title: summary.title,
        updated_at: summary.updated_at,
    })
}

pub fn update_conversation_title(
    connection: &Connection,
    id: &str,
    title: &str,
) -> Result<Option<ConversationRecordRow>, String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    let next_title = title.trim();

    if next_title.is_empty() {
        return Err("conversation title cannot be empty".to_string());
    }

    let Some(existing) = get_conversation_by_id(connection, id)? else {
        return Ok(None);
    };
    let updated_at = current_timestamp()?;

    insert_conversation_summary(
        connection,
        &ConversationSummaryRow {
            id: existing.id,
            title: next_title.to_string(),
            created_at: existing.created_at,
            updated_at,
        },
    )?;

    get_conversation_by_id(connection, id)
}

pub fn touch_conversation_updated_at(
    connection: &Connection,
    id: &str,
    updated_at: Option<&str>,
) -> Result<Option<String>, String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    let Some(existing) = get_conversation_by_id(connection, id)? else {
        return Ok(None);
    };
    let next_updated_at = match updated_at {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => current_timestamp()?,
    };

    insert_conversation_summary(
        connection,
        &ConversationSummaryRow {
            id: existing.id,
            title: existing.title,
            created_at: existing.created_at,
            updated_at: next_updated_at.clone(),
        },
    )?;

    Ok(Some(next_updated_at))
}

pub fn append_conversation_message(
    connection: &Connection,
    conversation_id: &str,
    role: &str,
    content: &str,
    created_at: Option<&str>,
) -> Result<ConversationMessageRow, String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    let Some(existing) = get_conversation_by_id(connection, conversation_id)? else {
        return Err("conversation was not found".to_string());
    };
    let next_created_at = match created_at {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => current_timestamp()?,
    };
    let message = ConversationMessageRow {
        id: next_identifier("message"),
        role: role.trim().to_string(),
        content: content.trim().to_string(),
        created_at: next_created_at.clone(),
    };

    if message.role.is_empty() {
        return Err("conversation message role is required".to_string());
    }

    if message.content.is_empty() {
        return Err("conversation message content cannot be empty".to_string());
    }

    let transaction = connection.unchecked_transaction().map_err(|error| error.to_string())?;
    insert_message(
        &transaction,
        conversation_id,
        &message.id,
        &message.role,
        &message.content,
        &message.created_at,
    )?;
    insert_conversation_summary(
        &transaction,
        &ConversationSummaryRow {
            id: existing.id,
            title: existing.title,
            created_at: existing.created_at,
            updated_at: next_created_at,
        },
    )?;
    transaction.commit().map_err(|error| error.to_string())?;

    Ok(message)
}

pub struct AppendCanvasHistoryParams<'a> {
    pub conversation_id: &'a str,
    pub created_at: Option<&'a str>,
    pub label: &'a str,
    pub preview_pages_json: &'a str,
    pub related_message_id: Option<&'a str>,
    pub source: &'a str,
    pub xml: &'a str,
}

pub fn append_canvas_history(
    connection: &Connection,
    params: AppendCanvasHistoryParams<'_>,
) -> Result<CanvasHistoryRow, String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    let Some(existing) = get_conversation_by_id(connection, params.conversation_id)? else {
        return Err("conversation was not found".to_string());
    };
    let next_created_at = match params.created_at {
        Some(value) if !value.trim().is_empty() => value.trim().to_string(),
        _ => current_timestamp()?,
    };
    let entry = CanvasHistoryRow {
        id: next_identifier("canvas-history"),
        conversation_id: params.conversation_id.to_string(),
        created_at: next_created_at.clone(),
        label: if params.label.trim().is_empty() {
            "Canvas Snapshot".to_string()
        } else {
            params.label.trim().to_string()
        },
        preview_pages_json: params.preview_pages_json.trim().to_string(),
        related_message_id: params.related_message_id.map(str::to_string),
        source: params.source.trim().to_string(),
        xml: params.xml.trim().to_string(),
    };

    if entry.source.is_empty() {
        return Err("canvas history source is required".to_string());
    }

    if entry.xml.is_empty() {
        return Err("canvas history xml cannot be empty".to_string());
    }

    let transaction = connection.unchecked_transaction().map_err(|error| error.to_string())?;
    insert_canvas_history_entry(
        &transaction,
        params.conversation_id,
        &entry.id,
        &entry.created_at,
        &entry.label,
        &entry.preview_pages_json,
        &entry.source,
        &entry.xml,
        entry.related_message_id.as_deref(),
    )?;
    insert_conversation_summary(
        &transaction,
        &ConversationSummaryRow {
            id: existing.id,
            title: existing.title,
            created_at: existing.created_at,
            updated_at: next_created_at,
        },
    )?;
    transaction.commit().map_err(|error| error.to_string())?;

    Ok(entry)
}

pub fn delete_conversation(connection: &Connection, id: &str) -> Result<bool, String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    if !has_conversation(connection, id)? {
        return Ok(false);
    }

    connection
        .execute("DELETE FROM messages WHERE conversation_id = ?1", params![id])
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "DELETE FROM canvas_history WHERE conversation_id = ?1",
            params![id],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM conversations WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;

    Ok(true)
}

pub fn list_conversation_summaries(
    connection: &Connection,
    search_query: Option<&str>,
    page: u32,
    page_size: u32,
) -> Result<ConversationSummaryPage, String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    let resolved_page = page.max(1);
    let resolved_page_size = page_size.max(1);
    let offset = ((resolved_page - 1) * resolved_page_size) as i64;
    let limit = resolved_page_size as i64;
    let normalized_query = search_query
        .map(normalize_title)
        .filter(|value| !value.is_empty());

    let total: u64 = if let Some(query) = normalized_query.as_ref() {
        connection
            .query_row(
                "SELECT COUNT(*) FROM conversations WHERE normalized_title LIKE ?1",
                params![format!("%{query}%")],
                |row| row.get(0),
            )
            .map_err(|error| error.to_string())?
    } else {
        connection
            .query_row("SELECT COUNT(*) FROM conversations", [], |row| row.get(0))
            .map_err(|error| error.to_string())?
    };

    let mut items = Vec::new();

    if let Some(query) = normalized_query.as_ref() {
        let mut statement = connection
            .prepare(
                "
                SELECT id, title, created_at, updated_at
                FROM conversations
                WHERE normalized_title LIKE ?1
                ORDER BY updated_at DESC, id ASC
                LIMIT ?2 OFFSET ?3
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![format!("%{query}%"), limit, offset], |row| {
                Ok(ConversationSummaryRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .map_err(|error| error.to_string())?;

        for row in rows {
            items.push(row.map_err(|error| error.to_string())?);
        }
    } else {
        let mut statement = connection
            .prepare(
                "
                SELECT id, title, created_at, updated_at
                FROM conversations
                ORDER BY updated_at DESC, id ASC
                LIMIT ?1 OFFSET ?2
                ",
            )
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map(params![limit, offset], |row| {
                Ok(ConversationSummaryRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .map_err(|error| error.to_string())?;

        for row in rows {
            items.push(row.map_err(|error| error.to_string())?);
        }
    }

    Ok(ConversationSummaryPage {
        items,
        page: resolved_page,
        page_size: resolved_page_size,
        total,
    })
}

pub fn clear_business_data(connection: &Connection) -> Result<(), String> {
    initialize_schema(connection).map_err(|error| error.to_string())?;

    connection
        .execute_batch(
            "
            DELETE FROM canvas_history;
            DELETE FROM messages;
            DELETE FROM conversations;
            ",
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        clear_business_data, initialize_schema, insert_canvas_history_entry,
        insert_conversation_summary, insert_message, list_conversation_summaries,
        ConversationSummaryRow,
    };
    use rusqlite::{params, Connection};

    fn test_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("in-memory sqlite should open");
        initialize_schema(&connection).expect("schema should initialize");

        connection
    }

    #[test]
    fn creates_business_tables_and_indexes() {
        let connection = test_connection();
        let mut statement = connection
            .prepare(
                "
                SELECT name
                FROM sqlite_master
                WHERE type IN ('table', 'index')
                  AND name IN (
                    'conversations',
                    'messages',
                    'canvas_history',
                    'conversations_updated_at_idx',
                    'conversations_normalized_title_idx',
                    'messages_conversation_id_idx',
                    'canvas_history_conversation_id_idx'
                  )
                ORDER BY name
                ",
            )
            .expect("sqlite_master query should prepare");
        let names = statement
            .query_map([], |row| row.get::<_, String>(0))
            .expect("sqlite_master query should run")
            .collect::<Result<Vec<_>, _>>()
            .expect("sqlite_master rows should collect");

        assert_eq!(
            names,
            vec![
                "canvas_history",
                "canvas_history_conversation_id_idx",
                "conversations",
                "conversations_normalized_title_idx",
                "conversations_updated_at_idx",
                "messages",
                "messages_conversation_id_idx",
            ]
        );
    }

    #[test]
    fn filters_title_search_and_paginates_summaries() {
        let connection = test_connection();

        insert_conversation_summary(
            &connection,
            &ConversationSummaryRow {
                id: "conversation-1".to_string(),
                title: "Alpha Diagram".to_string(),
                created_at: "2026-03-20T10:00:00.000Z".to_string(),
                updated_at: "2026-03-20T12:00:00.000Z".to_string(),
            },
        )
        .expect("first summary should insert");
        insert_conversation_summary(
            &connection,
            &ConversationSummaryRow {
                id: "conversation-2".to_string(),
                title: "Beta Diagram".to_string(),
                created_at: "2026-03-20T10:05:00.000Z".to_string(),
                updated_at: "2026-03-20T12:05:00.000Z".to_string(),
            },
        )
        .expect("second summary should insert");
        insert_conversation_summary(
            &connection,
            &ConversationSummaryRow {
                id: "conversation-3".to_string(),
                title: "Alpha Flow".to_string(),
                created_at: "2026-03-20T10:10:00.000Z".to_string(),
                updated_at: "2026-03-20T12:10:00.000Z".to_string(),
            },
        )
        .expect("third summary should insert");

        let first_page = list_conversation_summaries(&connection, Some("alpha"), 1, 1)
            .expect("first page should load");
        let second_page = list_conversation_summaries(&connection, Some("alpha"), 2, 1)
            .expect("second page should load");

        assert_eq!(first_page.total, 2);
        assert_eq!(first_page.items.len(), 1);
        assert_eq!(first_page.items[0].id, "conversation-3");
        assert_eq!(second_page.total, 2);
        assert_eq!(second_page.items.len(), 1);
        assert_eq!(second_page.items[0].id, "conversation-1");
    }

    #[test]
    fn clears_business_records_without_dropping_tables() {
        let connection = test_connection();

        insert_conversation_summary(
            &connection,
            &ConversationSummaryRow {
                id: "conversation-1".to_string(),
                title: "Alpha Diagram".to_string(),
                created_at: "2026-03-20T10:00:00.000Z".to_string(),
                updated_at: "2026-03-20T12:00:00.000Z".to_string(),
            },
        )
        .expect("summary should insert");
        insert_message(
            &connection,
            "conversation-1",
            "message-1",
            "user",
            "draft the diagram",
            "2026-03-20T12:01:00.000Z",
        )
        .expect("message should insert");
        insert_canvas_history_entry(
            &connection,
            "conversation-1",
            "canvas-history-1",
            "2026-03-20T12:02:00.000Z",
            "Initial Blank Canvas",
            "[]",
            "ai-pre-apply",
            "<mxGraphModel />",
            Some("message-1"),
        )
        .expect("canvas history should insert");

        clear_business_data(&connection).expect("clear should succeed");

        let conversation_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM conversations", [], |row| row.get(0))
            .expect("conversation count should load");
        let message_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM messages", [], |row| row.get(0))
            .expect("message count should load");
        let canvas_history_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM canvas_history", [], |row| row.get(0))
            .expect("canvas history count should load");
        let table_count: i64 = connection
            .query_row(
                "
                SELECT COUNT(*)
                FROM sqlite_master
                WHERE type = 'table'
                  AND name IN ('conversations', 'messages', 'canvas_history')
                ",
                [],
                |row| row.get(0),
            )
            .expect("table count should load");

        assert_eq!(conversation_count, 0);
        assert_eq!(message_count, 0);
        assert_eq!(canvas_history_count, 0);
        assert_eq!(table_count, 3);
    }

    #[test]
    fn search_is_case_insensitive() {
        let connection = test_connection();

        insert_conversation_summary(
            &connection,
            &ConversationSummaryRow {
                id: "conversation-1".to_string(),
                title: "Alpha Diagram".to_string(),
                created_at: "2026-03-20T10:00:00.000Z".to_string(),
                updated_at: "2026-03-20T12:00:00.000Z".to_string(),
            },
        )
        .expect("summary should insert");

        let page = list_conversation_summaries(&connection, Some("ALPHA"), 1, 10)
            .expect("search page should load");
        let stored_title: String = connection
            .query_row(
                "SELECT normalized_title FROM conversations WHERE id = ?1",
                params!["conversation-1"],
                |row| row.get(0),
            )
            .expect("normalized title should load");

        assert_eq!(stored_title, "alpha diagram");
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].id, "conversation-1");
    }
}
