import type { CanvasHistoryPreviewPage } from "./canvas-history-preview.ts";

export interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ConversationMessageRecord extends ConversationMessage {
  conversationId: string;
}

export type CanvasHistorySource = "ai-pre-apply" | "restore-pre-apply";

export interface CanvasHistoryEntry {
  id: string;
  conversationId: string;
  createdAt: string;
  label: string;
  previewPages: CanvasHistoryPreviewPage[];
  source: CanvasHistorySource;
  xml: string;
  relatedMessageId: string | null;
}

export interface ConversationRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
  canvasHistory: CanvasHistoryEntry[];
}

export interface ConversationSummaryRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type ConversationTimelineEntry =
  | ({ entryType: "message" } & ConversationMessage)
  | ({ entryType: "canvasHistory" } & CanvasHistoryEntry);

const DEFAULT_TITLE = "Untitled AI Session";
const PREVIEW_LIMIT = 120;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createConversationDraft({
  now = new Date().toISOString(),
  title
}: {
  now?: string;
  title?: string;
} = {}): ConversationRecord {
  return {
    id: `conversation-${globalThis.crypto?.randomUUID?.() ?? now.replaceAll(/[^0-9]/g, "")}`,
    title: title?.trim() || DEFAULT_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
    canvasHistory: []
  };
}

export function createConversationSummaryRecord(
  conversation: Pick<ConversationRecord, "id" | "title" | "createdAt" | "updatedAt">
): ConversationSummaryRecord {
  return {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt
  };
}

export function sortConversationsByUpdatedAt<T extends { updatedAt: string }>(
  conversations: T[]
): T[] {
  return [...conversations].sort((left, right) => {
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function getConversationPreview(conversation: {
  messages?: Array<{ content?: string | null }>;
}): string {
  const latestMessage = [...(conversation.messages ?? [])].pop();
  const content = latestMessage?.content?.trim() || "No messages yet.";
  return content.slice(0, PREVIEW_LIMIT);
}

export function buildNextConversationTitle(
  baseTitle: string,
  existingTitles: string[]
): string {
  const normalizedBaseTitle = baseTitle.trim() || DEFAULT_TITLE;
  const titlePattern = new RegExp(`^${escapeRegExp(normalizedBaseTitle)}\\s+(\\d+)$`);

  const nextIndex = existingTitles.reduce((highestIndex, title) => {
    const match = title.match(titlePattern);

    if (!match) {
      return highestIndex;
    }

    const index = Number.parseInt(match[1], 10);
    return Number.isFinite(index) ? Math.max(highestIndex, index) : highestIndex;
  }, 0);

  return `${normalizedBaseTitle} ${nextIndex + 1}`;
}

export function createConversationMessageRecord({
  conversationId,
  message
}: {
  conversationId: string;
  message: ConversationMessage;
}): ConversationMessageRecord {
  return {
    ...message,
    conversationId
  };
}

export function createWelcomeMessage(now = new Date().toISOString()): ConversationMessage {
  return {
    id: `message-${globalThis.crypto?.randomUUID?.() ?? now.replaceAll(/[^0-9]/g, "")}`,
    role: "assistant",
    content: "Start a new local AI conversation and then open the diagram workspace.",
    createdAt: now
  };
}

export function createCanvasHistoryEntry({
  conversationId,
  createdAt = new Date().toISOString(),
  label,
  previewPages,
  relatedMessageId = null,
  source,
  xml
}: {
  conversationId: string;
  createdAt?: string;
  label: string;
  previewPages: CanvasHistoryPreviewPage[];
  relatedMessageId?: string | null;
  source: CanvasHistorySource;
  xml: string;
}): CanvasHistoryEntry {
  return {
    id: `canvas-history-${globalThis.crypto?.randomUUID?.() ?? createdAt.replaceAll(/[^0-9]/g, "")}`,
    conversationId,
    createdAt,
    label: label.trim() || "Canvas Snapshot",
    previewPages,
    relatedMessageId,
    source,
    xml
  };
}

export function buildConversationTimeline(conversation: {
  canvasHistory?: CanvasHistoryEntry[];
  messages?: ConversationMessage[];
}): ConversationTimelineEntry[] {
  const assistantMessageIds = new Set(
    (conversation.messages ?? [])
      .filter((message) => message.role === "assistant")
      .map((message) => message.id)
  );
  const linkedUserMessageIds = new Set(
    (conversation.canvasHistory ?? [])
      .filter((entry) => entry.source === "ai-pre-apply" && Boolean(entry.relatedMessageId))
      .map((entry) => entry.relatedMessageId)
  );

  return [
    ...(conversation.messages ?? [])
      .filter((message) => !(message.role === "user" && linkedUserMessageIds.has(message.id)))
      .map((message) => ({
      ...message,
      entryType: "message" as const
      })),
    ...(conversation.canvasHistory ?? [])
      .filter((entry) => !(entry.relatedMessageId && assistantMessageIds.has(entry.relatedMessageId)))
      .map((entry) => ({
        ...entry,
        entryType: "canvasHistory" as const
      }))
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function buildSessionHref(_id?: string): string {
  return "/session";
}

export function buildBrowserFileTitle(sessionId: string): string {
  const normalizedSessionId = sessionId.trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${normalizedSessionId || "local-session"}.drawio`;
}
