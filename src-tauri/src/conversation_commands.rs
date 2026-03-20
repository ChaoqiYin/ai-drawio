use crate::conversation_db::{
    self, AppendCanvasHistoryParams, CanvasHistoryRow, ConversationDatabase,
    ConversationMessageRow, ConversationRecordRow, ConversationSummaryPage,
    ConversationSummaryRow,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSummaryPayload {
    pub created_at: String,
    pub id: String,
    pub title: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSummaryPagePayload {
    pub items: Vec<ConversationSummaryPayload>,
    pub page: u32,
    pub page_size: u32,
    pub total: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationMessagePayload {
    pub content: String,
    pub created_at: String,
    pub id: String,
    pub role: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasHistoryPayload {
    pub conversation_id: String,
    pub created_at: String,
    pub id: String,
    pub label: String,
    pub preview_pages: Value,
    pub related_message_id: Option<String>,
    pub source: String,
    pub xml: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationPayload {
    pub canvas_history: Vec<CanvasHistoryPayload>,
    pub created_at: String,
    pub id: String,
    pub messages: Vec<ConversationMessagePayload>,
    pub title: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendConversationMessageRequest {
    pub content: String,
    pub conversation_id: String,
    pub created_at: Option<String>,
    pub role: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendCanvasHistoryEntryRequest {
    pub conversation_id: String,
    pub created_at: Option<String>,
    pub label: String,
    pub preview_pages: Value,
    pub related_message_id: Option<String>,
    pub source: String,
    pub xml: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportConversationPayload {
    pub canvas_history: Vec<CanvasHistoryPayload>,
    pub created_at: String,
    pub id: String,
    pub messages: Vec<ConversationMessagePayload>,
    pub title: String,
    pub updated_at: String,
}

fn open_connection(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
) -> Result<rusqlite::Connection, String> {
    database.connection(&app)
}

fn parse_preview_pages(preview_pages_json: &str) -> Value {
    serde_json::from_str(preview_pages_json).unwrap_or_else(|_| Value::Array(Vec::new()))
}

fn to_summary_payload(summary: ConversationSummaryRow) -> ConversationSummaryPayload {
    ConversationSummaryPayload {
        created_at: summary.created_at,
        id: summary.id,
        title: summary.title,
        updated_at: summary.updated_at,
    }
}

fn to_summary_page_payload(page: ConversationSummaryPage) -> ConversationSummaryPagePayload {
    ConversationSummaryPagePayload {
        items: page.items.into_iter().map(to_summary_payload).collect(),
        page: page.page,
        page_size: page.page_size,
        total: page.total,
    }
}

fn to_message_payload(message: ConversationMessageRow) -> ConversationMessagePayload {
    ConversationMessagePayload {
        content: message.content,
        created_at: message.created_at,
        id: message.id,
        role: message.role,
    }
}

fn to_canvas_history_payload(entry: CanvasHistoryRow) -> CanvasHistoryPayload {
    CanvasHistoryPayload {
        conversation_id: entry.conversation_id,
        created_at: entry.created_at,
        id: entry.id,
        label: entry.label,
        preview_pages: parse_preview_pages(&entry.preview_pages_json),
        related_message_id: entry.related_message_id,
        source: entry.source,
        xml: entry.xml,
    }
}

fn to_conversation_payload(conversation: ConversationRecordRow) -> ConversationPayload {
    ConversationPayload {
        canvas_history: conversation
            .canvas_history
            .into_iter()
            .map(to_canvas_history_payload)
            .collect(),
        created_at: conversation.created_at,
        id: conversation.id,
        messages: conversation
            .messages
            .into_iter()
            .map(to_message_payload)
            .collect(),
        title: conversation.title,
        updated_at: conversation.updated_at,
    }
}

#[tauri::command]
pub fn list_conversation_summaries(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
    search_query: Option<String>,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Result<ConversationSummaryPagePayload, String> {
    let connection = open_connection(app, database)?;
    let page = conversation_db::list_conversation_summaries(
        &connection,
        search_query.as_deref(),
        page.unwrap_or(1),
        page_size.unwrap_or(10),
    )?;

    Ok(to_summary_page_payload(page))
}

#[tauri::command]
pub fn get_conversation(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
    id: String,
) -> Result<Option<ConversationPayload>, String> {
    let connection = open_connection(app, database)?;
    let conversation = conversation_db::get_conversation_by_id(&connection, &id)?;

    Ok(conversation.map(to_conversation_payload))
}

#[tauri::command]
pub fn create_conversation(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
    title: String,
) -> Result<ConversationPayload, String> {
    let connection = open_connection(app, database)?;
    let conversation = conversation_db::create_conversation(&connection, &title)?;

    Ok(to_conversation_payload(conversation))
}

#[tauri::command]
pub fn update_conversation_title(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
    id: String,
    title: String,
) -> Result<Option<ConversationPayload>, String> {
    let connection = open_connection(app, database)?;
    let conversation = conversation_db::update_conversation_title(&connection, &id, &title)?;

    Ok(conversation.map(to_conversation_payload))
}

#[tauri::command]
pub fn append_conversation_message(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
    request: AppendConversationMessageRequest,
) -> Result<ConversationMessagePayload, String> {
    let connection = open_connection(app, database)?;
    let message = conversation_db::append_conversation_message(
        &connection,
        &request.conversation_id,
        &request.role,
        &request.content,
        request.created_at.as_deref(),
    )?;

    Ok(to_message_payload(message))
}

#[tauri::command]
pub fn append_canvas_history_entry(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
    request: AppendCanvasHistoryEntryRequest,
) -> Result<CanvasHistoryPayload, String> {
    let connection = open_connection(app, database)?;
    let preview_pages_json =
        serde_json::to_string(&request.preview_pages).map_err(|error| error.to_string())?;
    let entry = conversation_db::append_canvas_history(
        &connection,
        AppendCanvasHistoryParams {
            conversation_id: &request.conversation_id,
            created_at: request.created_at.as_deref(),
            label: &request.label,
            preview_pages_json: &preview_pages_json,
            related_message_id: request.related_message_id.as_deref(),
            source: &request.source,
            xml: &request.xml,
        },
    )?;

    Ok(to_canvas_history_payload(entry))
}

#[tauri::command]
pub fn touch_conversation_updated_at(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
    id: String,
    updated_at: Option<String>,
) -> Result<Option<String>, String> {
    let connection = open_connection(app, database)?;

    conversation_db::touch_conversation_updated_at(&connection, &id, updated_at.as_deref())
}

#[tauri::command]
pub fn delete_conversation(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
    id: String,
) -> Result<bool, String> {
    let connection = open_connection(app, database)?;

    conversation_db::delete_conversation(&connection, &id)
}

#[tauri::command]
pub fn clear_conversation_data(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
) -> Result<(), String> {
    let connection = open_connection(app, database)?;

    conversation_db::clear_business_data(&connection)
}

#[tauri::command]
pub fn import_legacy_conversations(
    app: tauri::AppHandle,
    database: tauri::State<'_, ConversationDatabase>,
    conversations: Vec<ImportConversationPayload>,
) -> Result<u32, String> {
    let connection = open_connection(app, database)?;
    let transaction = connection
        .unchecked_transaction()
        .map_err(|error| error.to_string())?;

    for conversation in &conversations {
        conversation_db::insert_conversation_summary(
            &transaction,
            &ConversationSummaryRow {
                created_at: conversation.created_at.clone(),
                id: conversation.id.clone(),
                title: conversation.title.clone(),
                updated_at: conversation.updated_at.clone(),
            },
        )?;

        for message in &conversation.messages {
            conversation_db::insert_message(
                &transaction,
                &conversation.id,
                &message.id,
                &message.role,
                &message.content,
                &message.created_at,
            )?;
        }

        for entry in &conversation.canvas_history {
            let preview_pages_json =
                serde_json::to_string(&entry.preview_pages).map_err(|error| error.to_string())?;
            conversation_db::insert_canvas_history_entry(
                &transaction,
                &conversation.id,
                &entry.id,
                &entry.created_at,
                &entry.label,
                &preview_pages_json,
                &entry.source,
                &entry.xml,
                entry.related_message_id.as_deref(),
            )?;
        }
    }

    transaction.commit().map_err(|error| error.to_string())?;

    Ok(conversations.len() as u32)
}
