import {
  buildBrowserFileTitle,
  buildNextConversationTitle,
  createCanvasHistoryEntry,
  createConversationDraft,
  createConversationMessageRecord,
  createConversationSummaryRecord,
  createWelcomeMessage,
  sortConversationsByUpdatedAt,
  type CanvasHistoryEntry,
  type CanvasHistorySource,
  type ConversationMessage,
  type ConversationMessageRecord,
  type ConversationRecord,
  type ConversationSummaryRecord
} from "./conversation-model.ts";
import {
  buildBlankCanvasHistoryPreviewPages,
  normalizeCanvasHistoryPreviewPages,
  type CanvasHistoryPreviewPage
} from "./canvas-history-preview.ts";

const DATABASE_NAME = "ai-drawio-local-ai";
const DATABASE_VERSION = 3;
const CONVERSATION_STORE_NAME = "conversations";
const MESSAGE_STORE_NAME = "messages";
const CANVAS_HISTORY_STORE_NAME = "canvasHistory";
const CONVERSATION_CHANGE_EVENT = "ai-drawio:conversation-change";
const CONVERSATION_UPDATED_AT_INDEX = "updatedAt";
const MESSAGE_CONVERSATION_INDEX = "conversationId";
const MESSAGE_CONVERSATION_CREATED_AT_INDEX = "conversationId_createdAt";
const CANVAS_HISTORY_CONVERSATION_INDEX = "conversationId";
const CANVAS_HISTORY_CONVERSATION_CREATED_AT_INDEX = "conversationId_createdAt";
const CANVAS_HISTORY_CONVERSATION_MESSAGE_INDEX = "conversationId_relatedMessageId";
const DRAWIO_DATABASE_NAME = "database";
const DRAWIO_FILES_STORE_NAME = "files";
const DRAWIO_FILES_INFO_STORE_NAME = "filesInfo";

export type ConversationChangeDetail = {
  conversationId?: string;
  type: "created" | "updated" | "deleted" | "cleared";
};

type LegacyConversationRecord = ConversationSummaryRecord & {
  canvasHistory?: CanvasHistoryEntry[];
  messages?: ConversationMessage[];
};

type StoredCanvasHistoryEntry = Omit<CanvasHistoryEntry, "previewPages"> & {
  previewPages?: unknown;
};

function emitConversationChange(detail: ConversationChangeDetail): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<ConversationChangeDetail>(CONVERSATION_CHANGE_EVENT, { detail }));
}

export function subscribeConversationChanges(
  listener: (detail: ConversationChangeDetail) => void
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

function ensureBrowser(): void {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    throw new Error("IndexedDB is only available in the browser.");
  }
}

function ensureIndex(
  store: IDBObjectStore,
  indexName: string,
  keyPath: string | string[]
): void {
  if (!store.indexNames.contains(indexName)) {
    store.createIndex(indexName, keyPath);
  }
}

function migrateLegacyConversations(
  conversationStore: IDBObjectStore,
  messageStore: IDBObjectStore,
  canvasHistoryStore: IDBObjectStore
): void {
  const request = conversationStore.openCursor();

  request.onsuccess = () => {
    const cursor = request.result;

    if (!cursor) {
      return;
    }

    const legacyConversation = cursor.value as LegacyConversationRecord;
    const conversationId = legacyConversation.id;

    conversationStore.put(
      createConversationSummaryRecord({
        createdAt: legacyConversation.createdAt,
        id: conversationId,
        title: legacyConversation.title,
        updatedAt: legacyConversation.updatedAt
      })
    );

    for (const message of legacyConversation.messages ?? []) {
      messageStore.put(
        createConversationMessageRecord({
          conversationId,
          message
        })
      );
    }

    for (const historyEntry of legacyConversation.canvasHistory ?? []) {
      canvasHistoryStore.put({
        ...historyEntry,
        conversationId,
        previewPages: normalizeStoredCanvasHistoryPreviewPages(historyEntry.previewPages),
        relatedMessageId: historyEntry.relatedMessageId ?? null
      });
    }

    cursor.continue();
  };
}

function normalizeStoredCanvasHistoryPreviewPages(input: unknown): CanvasHistoryPreviewPage[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }

  return normalizeCanvasHistoryPreviewPages(input);
}

function normalizeCanvasHistoryEntry(entry: StoredCanvasHistoryEntry): CanvasHistoryEntry {
  if (!Array.isArray(entry.previewPages) || entry.previewPages.length === 0) {
    return {
      ...entry,
      previewPages: [],
      relatedMessageId: entry.relatedMessageId ?? null
    };
  }

  return {
    ...entry,
    previewPages: normalizeCanvasHistoryPreviewPages(entry.previewPages),
    relatedMessageId: entry.relatedMessageId ?? null
  };
}

function openDatabase(): Promise<IDBDatabase> {
  ensureBrowser();

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      const oldVersion =
        event instanceof IDBVersionChangeEvent && typeof event.oldVersion === "number"
          ? event.oldVersion
          : 0;

      const conversationStore = database.objectStoreNames.contains(CONVERSATION_STORE_NAME)
        ? transaction!.objectStore(CONVERSATION_STORE_NAME)
        : database.createObjectStore(CONVERSATION_STORE_NAME, { keyPath: "id" });

      ensureIndex(conversationStore, CONVERSATION_UPDATED_AT_INDEX, "updatedAt");

      const messageStore = database.objectStoreNames.contains(MESSAGE_STORE_NAME)
        ? transaction!.objectStore(MESSAGE_STORE_NAME)
        : database.createObjectStore(MESSAGE_STORE_NAME, { keyPath: "id" });

      ensureIndex(messageStore, MESSAGE_CONVERSATION_INDEX, "conversationId");
      ensureIndex(messageStore, MESSAGE_CONVERSATION_CREATED_AT_INDEX, ["conversationId", "createdAt"]);

      const canvasHistoryStore = database.objectStoreNames.contains(CANVAS_HISTORY_STORE_NAME)
        ? transaction!.objectStore(CANVAS_HISTORY_STORE_NAME)
        : database.createObjectStore(CANVAS_HISTORY_STORE_NAME, { keyPath: "id" });

      ensureIndex(canvasHistoryStore, CANVAS_HISTORY_CONVERSATION_INDEX, "conversationId");
      ensureIndex(canvasHistoryStore, CANVAS_HISTORY_CONVERSATION_CREATED_AT_INDEX, ["conversationId", "createdAt"]);
      ensureIndex(canvasHistoryStore, CANVAS_HISTORY_CONVERSATION_MESSAGE_INDEX, [
        "conversationId",
        "relatedMessageId"
      ]);

      if (request.transaction && oldVersion < 2) {
        migrateLegacyConversations(conversationStore, messageStore, canvasHistoryStore);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
}

function withStores<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  callback: (stores: Record<string, IDBObjectStore>) => T
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeNames, mode);
        const stores = Object.fromEntries(
          storeNames.map((storeName) => [storeName, transaction.objectStore(storeName)])
        ) as Record<string, IDBObjectStore>;

        let result: T;

        try {
          result = callback(stores);
        } catch (error) {
          database.close();
          reject(error);
          return;
        }

        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };
        transaction.onerror = () => {
          database.close();
          reject(transaction.error ?? new Error("IndexedDB transaction failed."));
        };
        transaction.onabort = () => {
          database.close();
          reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
        };
      })
  );
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function openDrawioDatabase(): Promise<IDBDatabase | null> {
  ensureBrowser();

  return new Promise(async (resolve, reject) => {
    try {
      if (typeof window.indexedDB.databases === "function") {
        const databases = await window.indexedDB.databases();
        const hasDrawioDatabase = databases.some((database) => database.name === DRAWIO_DATABASE_NAME);

        if (!hasDrawioDatabase) {
          resolve(null);
          return;
        }
      }

      const request = window.indexedDB.open("database", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open draw.io IndexedDB."));
    } catch (error) {
      reject(error);
    }
  });
}

async function deleteDrawioBrowserFile(sessionId: string): Promise<void> {
  ensureBrowser();

  const title = buildBrowserFileTitle(sessionId);
  const database = await openDrawioDatabase();

  if (!database) {
    window.localStorage.removeItem(title);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([DRAWIO_FILES_STORE_NAME, DRAWIO_FILES_INFO_STORE_NAME], "readwrite");

    transaction.objectStore(DRAWIO_FILES_STORE_NAME).delete(title);
    transaction.objectStore(DRAWIO_FILES_INFO_STORE_NAME).delete(title);
    transaction.oncomplete = () => {
      database.close();
      window.localStorage.removeItem(title);
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Failed to delete draw.io browser file."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Deleting draw.io browser file was aborted."));
    };
  });
}

function conversationCreatedAtRange(conversationId: string): IDBKeyRange {
  return IDBKeyRange.bound([conversationId, ""], [conversationId, "\uffff"]);
}

async function listConversationSummaries(): Promise<ConversationSummaryRecord[]> {
  return withStores([CONVERSATION_STORE_NAME], "readonly", async (stores) => {
    const summaries = await requestToPromise(
      stores[CONVERSATION_STORE_NAME].getAll() as IDBRequest<ConversationSummaryRecord[]>
    );

    return sortConversationsByUpdatedAt(summaries);
  });
}

async function getConversationSummaryById(
  id: string
): Promise<ConversationSummaryRecord | undefined> {
  return withStores([CONVERSATION_STORE_NAME], "readonly", (stores) =>
    requestToPromise(
      stores[CONVERSATION_STORE_NAME].get(id) as IDBRequest<ConversationSummaryRecord | undefined>
    )
  );
}

export async function findConversationByTitle(
  title: string
): Promise<ConversationRecord | undefined> {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    return undefined;
  }

  const conversations = await listConversations();
  return conversations.find((conversation) => conversation.title.trim() === normalizedTitle);
}

export async function listConversationMessages(
  conversationId: string
): Promise<ConversationMessageRecord[]> {
  if (!conversationId.trim()) {
    return [];
  }

  return withStores([MESSAGE_STORE_NAME], "readonly", async (stores) => {
    const index = stores[MESSAGE_STORE_NAME].index(MESSAGE_CONVERSATION_CREATED_AT_INDEX);

    return requestToPromise(
      index.getAll(conversationCreatedAtRange(conversationId)) as IDBRequest<ConversationMessageRecord[]>
    );
  });
}

export async function appendConversationMessage({
  content,
  conversationId,
  createdAt,
  role
}: {
  content: string;
  conversationId: string;
  createdAt?: string;
  role: string;
}): Promise<ConversationMessage> {
  if (!conversationId.trim()) {
    throw new Error("Conversation id is required.");
  }

  const normalizedContent = content.trim();

  if (!normalizedContent) {
    throw new Error("Conversation message content cannot be empty.");
  }

  const normalizedRole = role.trim();

  if (!normalizedRole) {
    throw new Error("Conversation message role is required.");
  }

  const summary = await getConversationSummaryById(conversationId);

  if (!summary) {
    throw new Error("未找到要写入消息的本地会话。");
  }

  const nextTimestamp = createdAt ?? new Date().toISOString();
  const message: ConversationMessage = {
    id: `message-${globalThis.crypto?.randomUUID?.() ?? nextTimestamp.replaceAll(/[^0-9]/g, "")}`,
    role: normalizedRole,
    content: normalizedContent,
    createdAt: nextTimestamp
  };

  await withStores([CONVERSATION_STORE_NAME, MESSAGE_STORE_NAME], "readwrite", async (stores) => {
    await requestToPromise(
      stores[MESSAGE_STORE_NAME].put(
        createConversationMessageRecord({
          conversationId,
          message
        })
      ) as IDBRequest<IDBValidKey>
    );
    await requestToPromise(
      stores[CONVERSATION_STORE_NAME].put({
        ...summary,
        updatedAt: nextTimestamp
      }) as IDBRequest<IDBValidKey>
    );
  });

  emitConversationChange({ type: "updated", conversationId });
  return message;
}

export async function listCanvasHistoryEntries(
  conversationId: string
): Promise<CanvasHistoryEntry[]> {
  if (!conversationId.trim()) {
    return [];
  }

  return withStores([CANVAS_HISTORY_STORE_NAME], "readonly", async (stores) => {
    const index = stores[CANVAS_HISTORY_STORE_NAME].index(CANVAS_HISTORY_CONVERSATION_CREATED_AT_INDEX);
    const entries = await requestToPromise(
      index.getAll(conversationCreatedAtRange(conversationId)) as IDBRequest<StoredCanvasHistoryEntry[]>
    );

    return entries.map((entry) => normalizeCanvasHistoryEntry(entry));
  });
}

export async function listCanvasHistoryEntriesByMessageId(
  conversationId: string,
  relatedMessageId: string
): Promise<CanvasHistoryEntry[]> {
  if (!conversationId.trim() || !relatedMessageId.trim()) {
    return [];
  }

  return withStores([CANVAS_HISTORY_STORE_NAME], "readonly", async (stores) => {
    const index = stores[CANVAS_HISTORY_STORE_NAME].index(CANVAS_HISTORY_CONVERSATION_MESSAGE_INDEX);
    const entries = await requestToPromise(
      index.getAll([conversationId, relatedMessageId]) as IDBRequest<StoredCanvasHistoryEntry[]>
    );

    return entries.map((entry) => normalizeCanvasHistoryEntry(entry));
  });
}

async function hydrateConversation(
  summary: ConversationSummaryRecord
): Promise<ConversationRecord> {
  const [messages, canvasHistory] = await Promise.all([
    listConversationMessages(summary.id),
    listCanvasHistoryEntries(summary.id)
  ]);

  return {
    ...summary,
    canvasHistory,
    messages: messages.map(({ conversationId: _conversationId, ...message }) => message)
  };
}

export async function listConversations(): Promise<ConversationRecord[]> {
  const summaries = await listConversationSummaries();
  return Promise.all(summaries.map((summary) => hydrateConversation(summary)));
}

export async function getConversationById(
  id: string
): Promise<ConversationRecord | undefined> {
  const summary = await getConversationSummaryById(id);

  if (!summary) {
    return undefined;
  }

  return hydrateConversation(summary);
}

export async function hasConversation(id: string): Promise<boolean> {
  if (!id.trim()) {
    return false;
  }

  return Boolean(await getConversationSummaryById(id));
}

async function putConversationSummary(summary: ConversationSummaryRecord): Promise<IDBValidKey> {
  return withStores([CONVERSATION_STORE_NAME], "readwrite", (stores) =>
    requestToPromise(
      stores[CONVERSATION_STORE_NAME].put(summary) as IDBRequest<IDBValidKey>
    )
  );
}

export async function appendCanvasHistoryEntry({
  conversationId,
  createdAt,
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
}): Promise<CanvasHistoryEntry> {
  if (!conversationId.trim()) {
    throw new Error("Conversation id is required.");
  }

  if (!xml.trim()) {
    throw new Error("Canvas snapshot xml cannot be empty.");
  }

  const summary = await getConversationSummaryById(conversationId);

  if (!summary) {
    throw new Error("未找到要写入画布历史的本地会话。");
  }

  const nextTimestamp = createdAt ?? new Date().toISOString();
  const entry = createCanvasHistoryEntry({
    conversationId,
    createdAt: nextTimestamp,
    label,
    previewPages,
    relatedMessageId,
    source,
    xml
  });

  await withStores([CONVERSATION_STORE_NAME, CANVAS_HISTORY_STORE_NAME], "readwrite", async (stores) => {
    await requestToPromise(
      stores[CANVAS_HISTORY_STORE_NAME].put(entry) as IDBRequest<IDBValidKey>
    );
    await requestToPromise(
      stores[CONVERSATION_STORE_NAME].put({
        ...summary,
        updatedAt: nextTimestamp
      }) as IDBRequest<IDBValidKey>
    );
  });

  emitConversationChange({ type: "updated", conversationId });
  return entry;
}

export async function updateConversationTitle(
  id: string,
  title: string
): Promise<ConversationRecord> {
  const summary = await getConversationSummaryById(id);

  if (!summary) {
    throw new Error("未找到要重命名的本地会话。");
  }

  const nextTitle = title.trim();

  if (!nextTitle) {
    throw new Error("会话名称不能为空。");
  }

  await putConversationSummary({
    ...summary,
    title: nextTitle,
    updatedAt: new Date().toISOString()
  });

  emitConversationChange({ type: "updated", conversationId: id });
  return (await getConversationById(id)) as ConversationRecord;
}

export async function deleteConversation(id: string): Promise<undefined> {
  const summary = await getConversationSummaryById(id);

  if (!summary) {
    return undefined;
  }

  await withStores(
    [CONVERSATION_STORE_NAME, MESSAGE_STORE_NAME, CANVAS_HISTORY_STORE_NAME],
    "readwrite",
    async (stores) => {
      const messageKeys = await requestToPromise(
        stores[MESSAGE_STORE_NAME]
          .index(MESSAGE_CONVERSATION_INDEX)
          .getAllKeys(id) as IDBRequest<IDBValidKey[]>
      );
      const canvasHistoryKeys = await requestToPromise(
        stores[CANVAS_HISTORY_STORE_NAME]
          .index(CANVAS_HISTORY_CONVERSATION_INDEX)
          .getAllKeys(id) as IDBRequest<IDBValidKey[]>
      );

      for (const key of messageKeys) {
        stores[MESSAGE_STORE_NAME].delete(key);
      }

      for (const key of canvasHistoryKeys) {
        stores[CANVAS_HISTORY_STORE_NAME].delete(key);
      }

      await requestToPromise(
        stores[CONVERSATION_STORE_NAME].delete(id) as IDBRequest<undefined>
      );
    }
  );

  await deleteDrawioBrowserFile(id);

  emitConversationChange({ type: "deleted", conversationId: id });
  return undefined;
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(name);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete database '${name}'.`));
    request.onblocked = () =>
      reject(new Error(`Deleting database '${name}' was blocked by another open connection.`));
  });
}

export async function clearAllIndexedDbDatabases(): Promise<void> {
  ensureBrowser();

  if (typeof window.indexedDB.databases !== "function") {
    throw new Error("当前环境不支持枚举并清空全部 IndexedDB 数据库。");
  }

  const databases = await window.indexedDB.databases();
  const names = databases
    .map((database) => database.name)
    .filter((name) => typeof name === "string" && name.length > 0);

  await Promise.all(names.map((name) => deleteDatabase(name)));
  emitConversationChange({ type: "cleared" });
}

export async function createConversation(title: string): Promise<ConversationRecord> {
  const now = new Date().toISOString();
  const existingConversations = await listConversationSummaries();
  const nextTitle = buildNextConversationTitle(
    title,
    existingConversations.map((conversation) => conversation.title)
  );
  const draft = createConversationDraft({ now, title: nextTitle });
  const welcomeMessage = createWelcomeMessage(now);
  const initialCanvasHistoryEntry = createCanvasHistoryEntry({
    conversationId: draft.id,
    createdAt: now,
    label: "Initial Blank Canvas",
    previewPages: buildBlankCanvasHistoryPreviewPages(),
    relatedMessageId: welcomeMessage.id,
    source: "ai-pre-apply",
    xml: "<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/></root></mxGraphModel>"
  });
  const summary = createConversationSummaryRecord(draft);

  await withStores([CONVERSATION_STORE_NAME, MESSAGE_STORE_NAME, CANVAS_HISTORY_STORE_NAME], "readwrite", async (stores) => {
    await requestToPromise(
      stores[CONVERSATION_STORE_NAME].put(summary) as IDBRequest<IDBValidKey>
    );
    await requestToPromise(
      stores[MESSAGE_STORE_NAME].put(
        createConversationMessageRecord({
          conversationId: draft.id,
          message: welcomeMessage
        })
      ) as IDBRequest<IDBValidKey>
    );
    await requestToPromise(
      stores[CANVAS_HISTORY_STORE_NAME].put(initialCanvasHistoryEntry) as IDBRequest<IDBValidKey>
    );
  });

  emitConversationChange({ type: "created", conversationId: draft.id });
  return {
    ...draft,
    canvasHistory: [initialCanvasHistoryEntry],
    messages: [welcomeMessage]
  };
}
