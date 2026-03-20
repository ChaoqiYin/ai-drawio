"use client";

import type {
  CanvasHistoryEntry,
  CanvasHistorySource,
  ConversationMessage,
  ConversationMessageRecord,
  ConversationRecord,
  ConversationSummaryRecord,
} from "./conversation-model.ts";
import type { CanvasHistoryPreviewPage } from "./canvas-history-preview.ts";

import { normalizeCanvasHistoryPreviewPages } from "./canvas-history-preview.ts";
import { getRequiredTauriInvoke } from "./tauri-invoke.ts";

export type ConversationSummaryPage = {
  items: ConversationSummaryRecord[];
  page: number;
  pageSize: number;
  total: number;
};

function normalizeCanvasHistoryEntries(entries: CanvasHistoryEntry[]): CanvasHistoryEntry[] {
  return entries.map((entry) => ({
    ...entry,
    previewPages:
      Array.isArray(entry.previewPages) && entry.previewPages.length > 0
        ? normalizeCanvasHistoryPreviewPages(entry.previewPages)
        : [],
    relatedMessageId: entry.relatedMessageId ?? null,
  }));
}

function normalizeConversationRecord(record: ConversationRecord): ConversationRecord {
  return {
    ...record,
    canvasHistory: normalizeCanvasHistoryEntries(record.canvasHistory ?? []),
    messages: Array.isArray(record.messages) ? record.messages : [],
  };
}

export async function listConversationSummaryPage({
  page = 1,
  pageSize = 10,
  searchQuery,
}: {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
} = {}): Promise<ConversationSummaryPage> {
  const invoke = getRequiredTauriInvoke();

  return invoke("list_conversation_summaries", {
    page,
    pageSize,
    searchQuery,
  }) as Promise<ConversationSummaryPage>;
}

export async function getConversationById(id: string): Promise<ConversationRecord | undefined> {
  const invoke = getRequiredTauriInvoke();
  const result = (await invoke("get_conversation", { id })) as ConversationRecord | null;

  if (!result) {
    return undefined;
  }

  return normalizeConversationRecord(result);
}

export async function listConversations(): Promise<ConversationRecord[]> {
  const page = await listConversationSummaryPage({ page: 1, pageSize: 1000 });
  const conversations = await Promise.all(page.items.map((item) => getConversationById(item.id)));

  return conversations.filter((item): item is ConversationRecord => Boolean(item));
}

export async function createConversation(title: string): Promise<ConversationRecord> {
  const invoke = getRequiredTauriInvoke();
  const conversation = (await invoke("create_conversation", {
    title,
  })) as ConversationRecord;

  return normalizeConversationRecord(conversation);
}

export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<ConversationRecord> {
  const invoke = getRequiredTauriInvoke();
  const conversation = (await invoke("update_conversation_title", {
    id,
    title,
  })) as ConversationRecord | null;

  if (!conversation) {
    throw new Error("未找到要重命名的本地会话。");
  }

  return normalizeConversationRecord(conversation);
}

export async function findConversationByTitle(title: string): Promise<ConversationRecord | undefined> {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    return undefined;
  }

  const page = await listConversationSummaryPage({
    page: 1,
    pageSize: 200,
    searchQuery: normalizedTitle,
  });
  const matchedSummary = page.items.find((item) => item.title.trim() === normalizedTitle);

  if (!matchedSummary) {
    return undefined;
  }

  return getConversationById(matchedSummary.id);
}

export async function hasConversation(id: string): Promise<boolean> {
  return Boolean(await getConversationById(id));
}

export async function listConversationMessages(
  conversationId: string,
): Promise<ConversationMessageRecord[]> {
  const conversation = await getConversationById(conversationId);

  return (conversation?.messages ?? []).map((message) => ({
    ...message,
    conversationId,
  }));
}

export async function appendConversationMessage({
  content,
  conversationId,
  createdAt,
  role,
}: {
  content: string;
  conversationId: string;
  createdAt?: string;
  role: string;
}): Promise<ConversationMessage> {
  const invoke = getRequiredTauriInvoke();

  return invoke("append_conversation_message", {
    request: {
      content,
      conversationId,
      createdAt,
      role,
    },
  }) as Promise<ConversationMessage>;
}

export async function listCanvasHistoryEntries(
  conversationId: string,
): Promise<CanvasHistoryEntry[]> {
  const conversation = await getConversationById(conversationId);

  return normalizeCanvasHistoryEntries(conversation?.canvasHistory ?? []);
}

export async function listCanvasHistoryEntriesByMessageId(
  conversationId: string,
  relatedMessageId: string,
): Promise<CanvasHistoryEntry[]> {
  const entries = await listCanvasHistoryEntries(conversationId);

  return entries.filter((entry) => entry.relatedMessageId === relatedMessageId);
}

export async function appendCanvasHistoryEntry({
  conversationId,
  createdAt,
  label,
  previewPages,
  relatedMessageId = null,
  source,
  xml,
}: {
  conversationId: string;
  createdAt?: string;
  label: string;
  previewPages: CanvasHistoryPreviewPage[];
  relatedMessageId?: string | null;
  source: CanvasHistorySource;
  xml: string;
}): Promise<CanvasHistoryEntry> {
  const invoke = getRequiredTauriInvoke();
  const entry = (await invoke("append_canvas_history_entry", {
    request: {
      conversationId,
      createdAt,
      label,
      previewPages,
      relatedMessageId,
      source,
      xml,
    },
  })) as CanvasHistoryEntry;

  return normalizeCanvasHistoryEntries([entry])[0];
}

export async function touchConversationUpdatedAt(
  id: string,
  updatedAt = new Date().toISOString(),
): Promise<string | undefined> {
  const invoke = getRequiredTauriInvoke();

  return invoke("touch_conversation_updated_at", {
    id,
    updatedAt,
  }) as Promise<string | undefined>;
}

export async function deleteConversation(id: string): Promise<void> {
  const invoke = getRequiredTauriInvoke();

  await invoke("delete_conversation", { id });
}

export async function clearConversationData(): Promise<void> {
  const invoke = getRequiredTauriInvoke();

  await invoke("clear_conversation_data");
}

export async function importLegacyConversations(
  conversations: ConversationRecord[],
): Promise<number> {
  const invoke = getRequiredTauriInvoke();

  return invoke("import_legacy_conversations", {
    conversations,
  }) as Promise<number>;
}
