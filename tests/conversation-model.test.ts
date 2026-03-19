import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSessionHref,
  buildNextConversationTitle,
  buildConversationTimeline,
  createCanvasHistoryEntry,
  createConversationDraft,
  getConversationPreview,
  sortConversationsByUpdatedAt
} from "../app/(internal)/_lib/conversation-model.ts";
import { normalizeCanvasHistoryPreviewPages } from "../app/(internal)/_lib/canvas-history-preview.ts";

test("createConversationDraft returns a usable local record", () => {
  const now = "2026-03-12T12:00:00.000Z";
  const draft = createConversationDraft({ now, title: "Local AI Session" });

  assert.ok(draft.id.startsWith("conversation-"));
  assert.equal(draft.title, "Local AI Session");
  assert.equal(draft.createdAt, now);
  assert.equal(draft.updatedAt, now);
  assert.deepEqual(draft.messages, []);
  assert.deepEqual(draft.canvasHistory, []);
  assert.equal("documentXml" in draft, false);
});

test("sortConversationsByUpdatedAt orders descending", () => {
  const result = sortConversationsByUpdatedAt([
    { id: "a", updatedAt: "2026-03-10T10:00:00.000Z" },
    { id: "b", updatedAt: "2026-03-12T10:00:00.000Z" },
    { id: "c", updatedAt: "2026-03-11T10:00:00.000Z" }
  ]);

  assert.deepEqual(result.map((item) => item.id), ["b", "c", "a"]);
});

test("getConversationPreview uses the latest message content", () => {
  const preview = getConversationPreview({
    messages: [
      { id: "m1", role: "user", content: "Plan the diagram" },
      { id: "m2", role: "assistant", content: "We should start with the database boundary." }
    ]
  });

  assert.equal(preview, "We should start with the database boundary.");
});

test("buildSessionHref targets the session route", () => {
  assert.equal(buildSessionHref("sess-1"), "/session");
});

test("buildNextConversationTitle increments the highest matching suffix", () => {
  const title = buildNextConversationTitle("Local AI Session", [
    "Local AI Session 1",
    "Local AI Session 2",
    "Other Session 9",
    "Local AI Session 7"
  ]);

  assert.equal(title, "Local AI Session 8");
});

test("buildNextConversationTitle starts at one when no matching title exists", () => {
  const title = buildNextConversationTitle("Local AI Session", [
    "Untitled AI Session",
    "Local AI Session",
    "Local AI Session draft"
  ]);

  assert.equal(title, "Local AI Session 1");
});

test("createCanvasHistoryEntry builds a related canvas snapshot record", () => {
  const now = "2026-03-16T09:30:00.000Z";
  const previewPages = normalizeCanvasHistoryPreviewPages([
    {
      id: "page-1",
      name: "Overview",
      svgDataUri: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="
    }
  ]);
  const entry = createCanvasHistoryEntry({
    conversationId: "conversation-1",
    createdAt: now,
    label: "AI Pre-Edit Snapshot",
    previewPages,
    relatedMessageId: "message-1",
    source: "ai-pre-apply",
    xml: "<mxGraphModel />"
  });

  assert.ok(entry.id.startsWith("canvas-history-"));
  assert.equal(entry.conversationId, "conversation-1");
  assert.equal(entry.relatedMessageId, "message-1");
  assert.equal(entry.source, "ai-pre-apply");
  assert.equal(entry.label, "AI Pre-Edit Snapshot");
  assert.equal(entry.createdAt, now);
  assert.equal(entry.xml, "<mxGraphModel />");
  assert.deepEqual(entry.previewPages, previewPages);
});

test("buildConversationTimeline merges messages and canvas history by descending time", () => {
  const timeline = buildConversationTimeline({
    canvasHistory: [
      createCanvasHistoryEntry({
        conversationId: "conversation-1",
        createdAt: "2026-03-16T09:10:00.000Z",
        label: "AI Pre-Edit Snapshot",
        previewPages: normalizeCanvasHistoryPreviewPages([
          {
            id: "page-1",
            name: "Overview",
            svgDataUri: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="
          }
        ]),
        source: "ai-pre-apply",
        xml: "<before />"
      })
    ],
    messages: [
      {
        id: "message-1",
        role: "assistant",
        content: "Applied a layout update.",
        createdAt: "2026-03-16T09:20:00.000Z"
      },
      {
        id: "message-2",
        role: "user",
        content: "Please rearrange the nodes.",
        createdAt: "2026-03-16T09:00:00.000Z"
      }
    ]
  });

  assert.deepEqual(
    timeline.map((entry) => `${entry.entryType}:${entry.createdAt}`),
    [
      "message:2026-03-16T09:20:00.000Z",
      "canvasHistory:2026-03-16T09:10:00.000Z",
      "message:2026-03-16T09:00:00.000Z"
    ]
  );
});

test("buildConversationTimeline hides linked user prompts when an AI snapshot already represents them", () => {
  const timeline = buildConversationTimeline({
    canvasHistory: [
      createCanvasHistoryEntry({
        conversationId: "conversation-1",
        createdAt: "2026-03-16T09:10:00.000Z",
        label: "AI Pre-Edit Snapshot",
        previewPages: normalizeCanvasHistoryPreviewPages([
          {
            id: "page-1",
            name: "Overview",
            svgDataUri: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="
          }
        ]),
        relatedMessageId: "message-user-1",
        source: "ai-pre-apply",
        xml: "<before />"
      })
    ],
    messages: [
      {
        id: "message-user-1",
        role: "user",
        content: "给第一页加一个方形",
        createdAt: "2026-03-16T09:09:00.000Z"
      },
      {
        id: "message-assistant-1",
        role: "assistant",
        content: "Applied a layout update.",
        createdAt: "2026-03-16T09:20:00.000Z"
      }
    ]
  });

  assert.deepEqual(
    timeline.map((entry) =>
      entry.entryType === "message"
        ? `${entry.entryType}:${entry.id}`
        : `${entry.entryType}:${entry.relatedMessageId}`
    ),
    [
      "message:message-assistant-1",
      "canvasHistory:message-user-1"
    ]
  );
});

test("buildConversationTimeline hides canvas history entries that are linked to assistant messages", () => {
  const timeline = buildConversationTimeline({
    canvasHistory: [
      createCanvasHistoryEntry({
        conversationId: "conversation-1",
        createdAt: "2026-03-16T09:10:00.000Z",
        label: "Initial Blank Canvas",
        previewPages: normalizeCanvasHistoryPreviewPages([
          {
            id: "page-1",
            name: "Blank",
            svgDataUri: "data:image/svg+xml;base64,PHN2Zz48L2JsYW5rLz4="
          }
        ]),
        relatedMessageId: "message-assistant-welcome",
        source: "ai-pre-apply",
        xml: "<blank />"
      })
    ],
    messages: [
      {
        id: "message-assistant-welcome",
        role: "assistant",
        content: "Start a new local AI conversation and then open the diagram workspace.",
        createdAt: "2026-03-16T09:00:00.000Z"
      }
    ]
  });

  assert.deepEqual(
    timeline.map((entry) =>
      entry.entryType === "message"
        ? `${entry.entryType}:${entry.id}`
        : `${entry.entryType}:${entry.relatedMessageId}`
    ),
    ["message:message-assistant-welcome"]
  );
});
