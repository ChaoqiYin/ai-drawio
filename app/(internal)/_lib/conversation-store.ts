"use client";

import type {
  CanvasHistoryEntry,
  CanvasHistorySource,
  ConversationMessage,
  ConversationMessageRecord,
  ConversationRecord,
} from "./conversation-model.ts";
import type { CanvasHistoryPreviewPage } from "./canvas-history-preview.ts";

import { hasTauriInvoke } from "./tauri-invoke.ts";
import * as legacyConversationStore from "./legacy-indexeddb-conversation-store.ts";
import * as tauriConversationStore from "./tauri-conversation-store.ts";

const CONVERSATION_CHANGE_EVENT = "ai-drawio:conversation-change";

export type ConversationChangeDetail = {
  conversationId?: string;
  type: "created" | "updated" | "deleted" | "cleared";
};

function emitConversationChange(detail: ConversationChangeDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<ConversationChangeDetail>(CONVERSATION_CHANGE_EVENT, { detail }));
}

function shouldUseTauriConversationStore(): boolean {
  return hasTauriInvoke();
}

export function subscribeConversationChanges(
  listener: (detail: ConversationChangeDetail) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = (event: Event) => {
    listener((event as CustomEvent<ConversationChangeDetail>).detail);
  };

  window.addEventListener(CONVERSATION_CHANGE_EVENT, handleChange);

  return () => {
    window.removeEventListener(CONVERSATION_CHANGE_EVENT, handleChange);
  };
}

export async function listConversationSummaryPage(options?: {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}): Promise<tauriConversationStore.ConversationSummaryPage> {
  if (shouldUseTauriConversationStore()) {
    return tauriConversationStore.listConversationSummaryPage(options);
  }

  const conversations = await legacyConversationStore.listConversations();
  const searchQuery = options?.searchQuery?.trim().toLowerCase() ?? "";
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const filteredItems = conversations
    .filter((conversation) =>
      !searchQuery ? true : conversation.title.trim().toLowerCase().includes(searchQuery),
    )
    .map(({ canvasHistory: _canvasHistory, messages: _messages, ...summary }) => summary);
  const startIndex = Math.max(0, (page - 1) * pageSize);

  return {
    items: filteredItems.slice(startIndex, startIndex + pageSize),
    page,
    pageSize,
    total: filteredItems.length,
  };
}

export async function listConversations(): Promise<ConversationRecord[]> {
  if (shouldUseTauriConversationStore()) {
    return tauriConversationStore.listConversations();
  }

  return legacyConversationStore.listConversations();
}

export async function getConversationById(id: string): Promise<ConversationRecord | undefined> {
  if (shouldUseTauriConversationStore()) {
    return tauriConversationStore.getConversationById(id);
  }

  return legacyConversationStore.getConversationById(id);
}

export async function findConversationByTitle(title: string): Promise<ConversationRecord | undefined> {
  if (shouldUseTauriConversationStore()) {
    return tauriConversationStore.findConversationByTitle(title);
  }

  return legacyConversationStore.findConversationByTitle(title);
}

export async function listConversationMessages(
  conversationId: string,
): Promise<ConversationMessageRecord[]> {
  if (shouldUseTauriConversationStore()) {
    return tauriConversationStore.listConversationMessages(conversationId);
  }

  return legacyConversationStore.listConversationMessages(conversationId);
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
  if (shouldUseTauriConversationStore()) {
    const message = await tauriConversationStore.appendConversationMessage({
      content,
      conversationId,
      createdAt,
      role,
    });
    emitConversationChange({ type: "updated", conversationId });
    return message;
  }

  return legacyConversationStore.appendConversationMessage({
    content,
    conversationId,
    createdAt,
    role,
  });
}

export async function listCanvasHistoryEntries(
  conversationId: string,
): Promise<CanvasHistoryEntry[]> {
  if (shouldUseTauriConversationStore()) {
    return tauriConversationStore.listCanvasHistoryEntries(conversationId);
  }

  return legacyConversationStore.listCanvasHistoryEntries(conversationId);
}

export async function listCanvasHistoryEntriesByMessageId(
  conversationId: string,
  relatedMessageId: string,
): Promise<CanvasHistoryEntry[]> {
  if (shouldUseTauriConversationStore()) {
    return tauriConversationStore.listCanvasHistoryEntriesByMessageId(conversationId, relatedMessageId);
  }

  return legacyConversationStore.listCanvasHistoryEntriesByMessageId(conversationId, relatedMessageId);
}

export async function createConversation(title: string): Promise<ConversationRecord> {
  if (shouldUseTauriConversationStore()) {
    const conversation = await tauriConversationStore.createConversation(title);
    emitConversationChange({ type: "created", conversationId: conversation.id });
    return conversation;
  }

  return legacyConversationStore.createConversation(title);
}

export async function hasConversation(id: string): Promise<boolean> {
  if (shouldUseTauriConversationStore()) {
    return tauriConversationStore.hasConversation(id);
  }

  return legacyConversationStore.hasConversation(id);
}

export async function touchConversationUpdatedAt(
  id: string,
  updatedAt = new Date().toISOString(),
): Promise<string | undefined> {
  if (shouldUseTauriConversationStore()) {
    const result = await tauriConversationStore.touchConversationUpdatedAt(id, updatedAt);

    if (result) {
      emitConversationChange({ type: "updated", conversationId: id });
    }

    return result;
  }

  return legacyConversationStore.touchConversationUpdatedAt(id, updatedAt);
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
  if (shouldUseTauriConversationStore()) {
    const entry = await tauriConversationStore.appendCanvasHistoryEntry({
      conversationId,
      createdAt,
      label,
      previewPages,
      relatedMessageId,
      source,
      xml,
    });
    emitConversationChange({ type: "updated", conversationId });
    return entry;
  }

  return legacyConversationStore.appendCanvasHistoryEntry({
    conversationId,
    createdAt,
    label,
    previewPages,
    relatedMessageId,
    source,
    xml,
  });
}

export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<ConversationRecord> {
  if (shouldUseTauriConversationStore()) {
    const conversation = await tauriConversationStore.updateConversationTitle(id, title);
    emitConversationChange({ type: "updated", conversationId: id });
    return conversation;
  }

  return legacyConversationStore.updateConversationTitle(id, title);
}

export async function deleteConversation(id: string): Promise<undefined> {
  if (shouldUseTauriConversationStore()) {
    await tauriConversationStore.deleteConversation(id);
    await legacyConversationStore.deleteDrawioBrowserFile(id);
    emitConversationChange({ type: "deleted", conversationId: id });
    return undefined;
  }

  return legacyConversationStore.deleteConversation(id);
}

export async function clearAllIndexedDbDatabases(): Promise<void> {
  return legacyConversationStore.clearAllIndexedDbDatabases();
}

export async function clearAllAppData(): Promise<void> {
  if (shouldUseTauriConversationStore()) {
    await tauriConversationStore.clearConversationData();
  }

  await legacyConversationStore.clearAllIndexedDbDatabases();

  if (shouldUseTauriConversationStore()) {
    emitConversationChange({ type: "cleared" });
  }
}

export async function importLegacyIndexedDbConversations(): Promise<number> {
  if (!shouldUseTauriConversationStore()) {
    return 0;
  }

  const existingPage = await tauriConversationStore.listConversationSummaryPage({
    page: 1,
    pageSize: 1,
  });

  if (existingPage.total > 0) {
    return 0;
  }

  const legacyConversations = await legacyConversationStore.listConversations();

  if (legacyConversations.length === 0) {
    return 0;
  }

  const importedCount = await tauriConversationStore.importLegacyConversations(legacyConversations);

  if (importedCount > 0) {
    emitConversationChange({ type: "created" });
  }

  return importedCount;
}
