# SQLite Conversation Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate business conversation storage from browser IndexedDB to bundled SQLite in the Tauri shell while preserving draw.io iframe browser storage cleanup behavior.

**Architecture:** Keep draw.io's iframe-managed browser storage untouched, but move conversation summaries, messages, and canvas history records into a Rust-owned SQLite database. Preserve the existing TypeScript `conversation-store` API as a facade so existing pages and shell bridge code can migrate incrementally, with desktop builds using Tauri commands and web fallback still using the legacy IndexedDB implementation.

**Tech Stack:** Next.js App Router, TypeScript, Tauri 2, Rust, `rusqlite` with bundled SQLite, Node test runner, Rust unit tests.

---

## File Map

**Create:**
- `src-tauri/src/conversation_db.rs`
- `src-tauri/src/conversation_commands.rs`
- `app/(internal)/_lib/tauri-invoke.ts`
- `app/(internal)/_lib/tauri-conversation-store.ts`
- `app/(internal)/_lib/legacy-indexeddb-conversation-store.ts`
- `tests/conversation-store-sqlite-source.test.ts`
- `tests/conversation-home-pagination-source.test.ts`
- `tests/tauri-conversation-commands-source.test.ts`

**Modify:**
- `src-tauri/Cargo.toml`
- `src-tauri/src/main.rs`
- `src-tauri/src/session_runtime.rs`
- `src-tauri/src/control_protocol.rs`
- `src-tauri/src/control_server.rs`
- `app/(internal)/_lib/conversation-store.ts`
- `app/(internal)/_components/conversation-home.tsx`
- `app/(internal)/_components/internal-shell-bridge.tsx`
- `app/(internal)/_components/session-tabs-shell.tsx`
- `app/(internal)/_components/session-workspace.tsx`
- `tests/conversation-store-api.test.ts`
- `tests/conversation-home-source.test.ts`
- `tests/session-workspace-storage.test.ts`

**Responsibilities:**
- `src-tauri/src/conversation_db.rs`: Own SQLite schema, migrations, CRUD queries, search, pagination, clear operations, and import helpers.
- `src-tauri/src/conversation_commands.rs`: Convert Tauri invoke payloads to database calls and serialize API responses for the frontend.
- `app/(internal)/_lib/tauri-invoke.ts`: Shared desktop invoke helper.
- `app/(internal)/_lib/tauri-conversation-store.ts`: Frontend adapter for Rust-backed conversation operations.
- `app/(internal)/_lib/legacy-indexeddb-conversation-store.ts`: Browser-only IndexedDB implementation retained for migration import and web fallback.
- `app/(internal)/_lib/conversation-store.ts`: Stable facade that routes to SQLite on desktop and IndexedDB on web, and still emits browser-side change events.
- `app/(internal)/_components/conversation-home.tsx`: Switch homepage listing to summary query with search and pagination.
- `src-tauri/src/session_runtime.rs`, `src-tauri/src/control_protocol.rs`, `src-tauri/src/control_server.rs`: Move CLI/control-server session lookup off the page bridge where it directly depends on conversation storage.

## Chunk 1: SQLite Foundation

### Task 1: Add bundled SQLite and database module scaffolding

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/main.rs`
- Create: `src-tauri/src/conversation_db.rs`
- Test: `tests/tauri-conversation-commands-source.test.ts`

- [ ] **Step 1: Write the failing source-level test**

```ts
test('tauri conversation storage wires bundled sqlite support', async () => {
  const [cargoToml, mainSource] = await Promise.all([
    readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8'),
    readFile(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf8'),
  ]);

  assert.match(cargoToml, /rusqlite\s*=\s*\{[\s\S]*bundled/);
  assert.match(mainSource, /mod conversation_db;/);
  assert.match(mainSource, /manage\(conversation_db::ConversationDatabase::new/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/tauri-conversation-commands-source.test.ts`
Expected: FAIL because the Rust SQLite module and dependency are not wired yet.

- [ ] **Step 3: Implement the SQLite runtime shell**

Add `rusqlite` with `bundled` support, create a `ConversationDatabase` state object in `src-tauri/src/conversation_db.rs`, and register it in `src-tauri/src/main.rs`. The database should resolve a file path under the app data directory and create schema lazily on first use.

- [ ] **Step 4: Run tests to verify the shell is wired**

Run: `npm run test:node -- tests/tauri-conversation-commands-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/main.rs src-tauri/src/conversation_db.rs tests/tauri-conversation-commands-source.test.ts
git commit -m "feat: add sqlite conversation database scaffold"
```

### Task 2: Define schema, indexes, and clear operations

**Files:**
- Modify: `src-tauri/src/conversation_db.rs`
- Test: `src-tauri/src/conversation_db.rs`

- [ ] **Step 1: Write failing Rust unit tests for schema behavior**

Add Rust tests that verify:
- conversations, messages, and canvas history tables are created
- title search can filter by `LIKE`
- summary query supports `LIMIT` and `OFFSET`
- clear operation deletes business records only

- [ ] **Step 2: Run the Rust tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml conversation_db`
Expected: FAIL because the schema and query helpers are incomplete.

- [ ] **Step 3: Implement minimal schema and query helpers**

Create tables and indexes:
- `conversations(id TEXT PRIMARY KEY, title TEXT NOT NULL, normalized_title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `messages(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL)`
- `canvas_history(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, created_at TEXT NOT NULL, label TEXT NOT NULL, preview_pages_json TEXT NOT NULL, source TEXT NOT NULL, xml TEXT NOT NULL, related_message_id TEXT)`

Add indexes:
- `conversations(updated_at DESC, id)`
- `conversations(normalized_title)`
- foreign-key-like lookup indexes on `messages.conversation_id` and `canvas_history.conversation_id`

- [ ] **Step 4: Run the Rust tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml conversation_db`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/conversation_db.rs
git commit -m "feat: add sqlite conversation schema"
```

## Chunk 2: Tauri Command Surface

### Task 3: Expose CRUD, summary search, pagination, and import commands

**Files:**
- Create: `src-tauri/src/conversation_commands.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `tests/tauri-conversation-commands-source.test.ts`

- [ ] **Step 1: Extend the failing source-level test**

Assert that `src-tauri/src/main.rs` registers commands for:
- `list_conversation_summaries`
- `get_conversation`
- `create_conversation`
- `update_conversation_title`
- `append_conversation_message`
- `append_canvas_history_entry`
- `touch_conversation_updated_at`
- `delete_conversation`
- `clear_conversation_data`
- `import_legacy_conversations`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/tauri-conversation-commands-source.test.ts`
Expected: FAIL because the commands are not registered yet.

- [ ] **Step 3: Implement the command layer**

Define serializable request and response structs that match the existing TypeScript conversation model. Include a summary list response with:

```ts
{
  items: Array<{ id: string; title: string; createdAt: string; updatedAt: string }>;
  page: number;
  pageSize: number;
  total: number;
}
```

Import command payload should accept full legacy records from the browser so the old IndexedDB store can be migrated without Rust needing direct browser access.

- [ ] **Step 4: Run source tests and Rust checks**

Run: `npm run test:node -- tests/tauri-conversation-commands-source.test.ts`
Expected: PASS

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/conversation_commands.rs src-tauri/src/main.rs tests/tauri-conversation-commands-source.test.ts
git commit -m "feat: add tauri sqlite conversation commands"
```

### Task 4: Detach CLI/control-server session lookups from page-backed conversation queries

**Files:**
- Modify: `src-tauri/src/session_runtime.rs`
- Modify: `src-tauri/src/control_protocol.rs`
- Modify: `src-tauri/src/control_server.rs`
- Test: `src-tauri/src/control_protocol.rs`

- [ ] **Step 1: Add or extend failing Rust tests for session lookup behavior**

Cover:
- list sessions reads conversation summaries without a page bridge
- get by title uses normalized title lookup
- missing title returns `SESSION_NOT_FOUND`

- [ ] **Step 2: Run targeted Rust tests to verify they fail**

Run: `cargo test --manifest-path src-tauri/Cargo.toml control_protocol session_runtime`
Expected: FAIL because session runtime still shells through `window.__AI_DRAWIO_SHELL__.conversationStore`.

- [ ] **Step 3: Implement the direct database path**

Keep navigation and shell readiness in `session_runtime.rs`, but replace conversation existence, list, and lookup calls with direct SQLite reads. Only page actions that truly require the open webview should continue using bridge scripts.

- [ ] **Step 4: Run targeted Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml control_protocol session_runtime`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/session_runtime.rs src-tauri/src/control_protocol.rs src-tauri/src/control_server.rs
git commit -m "refactor: move session queries to sqlite"
```

## Chunk 3: Frontend Storage Facade

### Task 5: Split legacy IndexedDB code from the facade and add Tauri invoke helpers

**Files:**
- Create: `app/(internal)/_lib/tauri-invoke.ts`
- Create: `app/(internal)/_lib/tauri-conversation-store.ts`
- Create: `app/(internal)/_lib/legacy-indexeddb-conversation-store.ts`
- Modify: `app/(internal)/_lib/conversation-store.ts`
- Modify: `tests/conversation-store-api.test.ts`
- Create: `tests/conversation-store-sqlite-source.test.ts`

- [ ] **Step 1: Write failing source-level tests for the facade split**

Add checks that:
- `conversation-store.ts` still exports the current public functions
- a legacy IndexedDB module exists
- a Tauri-backed store exists
- the facade keeps browser-side cleanup helpers for draw.io IndexedDB

- [ ] **Step 2: Run the Node tests to verify they fail**

Run: `npm run test:node -- tests/conversation-store-api.test.ts tests/conversation-store-sqlite-source.test.ts`
Expected: FAIL because the split modules do not exist yet.

- [ ] **Step 3: Implement the storage facade**

Rules:
- Desktop/Tauri path: use `tauri-invoke.ts` and `tauri-conversation-store.ts`
- Browser/web path: use `legacy-indexeddb-conversation-store.ts`
- `subscribeConversationChanges` and change events remain browser-side
- draw.io cleanup helpers remain browser-side even when conversation business data comes from SQLite

- [ ] **Step 4: Run the Node tests**

Run: `npm run test:node -- tests/conversation-store-api.test.ts tests/conversation-store-sqlite-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/(internal)/_lib/tauri-invoke.ts app/(internal)/_lib/tauri-conversation-store.ts app/(internal)/_lib/legacy-indexeddb-conversation-store.ts app/(internal)/_lib/conversation-store.ts tests/conversation-store-api.test.ts tests/conversation-store-sqlite-source.test.ts
git commit -m "refactor: add sqlite-backed conversation store facade"
```

### Task 6: Add legacy import flow and dual clear semantics

**Files:**
- Modify: `app/(internal)/_lib/conversation-store.ts`
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `tests/conversation-store-api.test.ts`
- Modify: `tests/conversation-home-source.test.ts`

- [ ] **Step 1: Write failing source-level tests**

Cover:
- facade exposes a method that imports legacy IndexedDB records into SQLite on desktop startup
- homepage clear-all action calls SQLite clear plus browser IndexedDB clear
- delete still cleans the matching draw.io browser file

- [ ] **Step 2: Run the Node tests to verify they fail**

Run: `npm run test:node -- tests/conversation-store-api.test.ts tests/conversation-home-source.test.ts`
Expected: FAIL because the combined clear and import flow are missing.

- [ ] **Step 3: Implement minimal import and clear orchestration**

Requirements:
- only import when desktop mode is active and SQLite is empty or uninitialized
- do not auto-delete draw.io IndexedDB data after import
- `clearAllAppData()` should clear SQLite business data first, then clear browser IndexedDB databases
- single delete should remove SQLite records, then call the existing draw.io browser file cleanup helper

- [ ] **Step 4: Run Node tests**

Run: `npm run test:node -- tests/conversation-store-api.test.ts tests/conversation-home-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/(internal)/_lib/conversation-store.ts app/(internal)/_components/conversation-home.tsx tests/conversation-store-api.test.ts tests/conversation-home-source.test.ts
git commit -m "feat: add sqlite import and dual clear flow"
```

## Chunk 4: Homepage Search and Pagination

### Task 7: Move the homepage list to summary queries with title search and 10-item pages

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `app/(internal)/_components/internal-shell-bridge.tsx`
- Create: `tests/conversation-home-pagination-source.test.ts`
- Modify: `tests/conversation-home-source.test.ts`

- [ ] **Step 1: Write failing source-level tests for homepage list behavior**

Assertions should require:
- a title search input
- page size fixed to `10`
- summary query call with search text and pagination params
- pagination controls wired in the homepage component

- [ ] **Step 2: Run the Node tests to verify they fail**

Run: `npm run test:node -- tests/conversation-home-source.test.ts tests/conversation-home-pagination-source.test.ts`
Expected: FAIL because the page still loads the full conversation list.

- [ ] **Step 3: Implement the smallest summary-based homepage query**

Requirements:
- homepage loads summary rows only
- search uses fuzzy-enough title contains semantics backed by SQLite `LIKE`
- page change requests a new summary page instead of slicing a fully hydrated list in memory
- existing create, rename, delete, and navigation behavior remain intact
- shell bridge `conversationStore.listConversations()` should either keep old semantics for compatibility or add a dedicated summary query method and migrate callers deliberately

- [ ] **Step 4: Run the Node tests**

Run: `npm run test:node -- tests/conversation-home-source.test.ts tests/conversation-home-pagination-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/(internal)/_components/conversation-home.tsx app/(internal)/_components/internal-shell-bridge.tsx tests/conversation-home-source.test.ts tests/conversation-home-pagination-source.test.ts
git commit -m "feat: add paginated sqlite-backed homepage search"
```

## Chunk 5: Workspace and Tab Compatibility

### Task 8: Preserve workspace history, rename, and session-tab behavior on the new store

**Files:**
- Modify: `app/(internal)/_components/session-tabs-shell.tsx`
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Modify: `tests/session-workspace-storage.test.ts`
- Modify: `tests/session-tabs-shell-source.test.ts`

- [ ] **Step 1: Write failing source-level tests around storage integration**

Cover:
- workspace reloads conversations from the facade
- apply-document history still appends messages and canvas history
- session tabs still resolve title and updatedAt from stored conversations

- [ ] **Step 2: Run the Node tests to verify they fail**

Run: `npm run test:node -- tests/session-workspace-storage.test.ts tests/session-tabs-shell-source.test.ts`
Expected: FAIL if the refactor breaks storage call sites or imports.

- [ ] **Step 3: Make the minimum compatibility edits**

Keep component APIs stable. If the facade preserves old method names, component changes should remain small and focused on any renamed clear/import helpers.

- [ ] **Step 4: Run the Node tests**

Run: `npm run test:node -- tests/session-workspace-storage.test.ts tests/session-tabs-shell-source.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/(internal)/_components/session-tabs-shell.tsx app/(internal)/_components/session-workspace.tsx tests/session-workspace-storage.test.ts tests/session-tabs-shell-source.test.ts
git commit -m "refactor: preserve workspace flows on sqlite storage"
```

## Chunk 6: Verification and Cleanup

### Task 9: Run end-to-end verification for desktop storage migration

**Files:**
- Modify: `docs/superpowers/plans/2026-03-20-sqlite-conversation-migration.md`

- [ ] **Step 1: Run focused Node tests**

Run:
```bash
npm run test:node -- \
  tests/conversation-store-api.test.ts \
  tests/conversation-store-sqlite-source.test.ts \
  tests/conversation-home-source.test.ts \
  tests/conversation-home-pagination-source.test.ts \
  tests/session-workspace-storage.test.ts \
  tests/session-tabs-shell-source.test.ts \
  tests/tauri-conversation-commands-source.test.ts
```
Expected: PASS

- [ ] **Step 2: Run Rust verification**

Run:
```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```
Expected: PASS

- [ ] **Step 3: Run an interactive desktop smoke test**

Run: `npm run dev`
Verify manually:
- existing IndexedDB conversations import once into SQLite
- homepage search filters by title contains
- pagination shows 10 items per page
- opening a conversation still restores history
- deleting a conversation removes business data and the draw.io browser file
- clearing all data wipes SQLite and browser IndexedDB data

- [ ] **Step 4: Document any follow-up gaps**

If any behavior remains intentionally deferred, capture it in the final PR description rather than silently shipping partial migration. Likely follow-ups include FTS-backed title search, migration telemetry, and a user-facing “import completed” notice.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: verify sqlite conversation storage migration"
```

## Notes and Constraints

- Do not attempt to move draw.io iframe-managed browser documents into SQLite. That storage remains browser-owned by design.
- Do not remove browser-side IndexedDB cleanup helpers; they are still required for delete and clear flows.
- Prefer preserving the existing TypeScript `ConversationRecord` and `ConversationSummaryRecord` shapes to keep UI changes small.
- Keep the migration idempotent. Import must be safe to re-run without duplicating records.
- Avoid forcing pure web builds onto SQLite. The browser fallback should continue to work when Tauri invoke is unavailable.

## Execution Guidance

- Use @superpowers/test-driven-development before each implementation task.
- Use @superpowers/verification-before-completion before claiming the migration is done.
- If executing with subagents, split ownership by write scope:
  - Rust database and command modules
  - frontend store facade and import flow
  - homepage pagination/search UI and tests
