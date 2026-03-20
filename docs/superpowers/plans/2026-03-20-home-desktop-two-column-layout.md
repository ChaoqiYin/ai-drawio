# Home Desktop Two Column Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the internal home page to a desktop-first two-column flex layout with a fixed-width left action panel, a right content panel that contains search and pagination above the list, and a list-only scroll region.

**Architecture:** Keep the existing `ConversationHome` data and interaction logic intact and refactor only the JSX structure and layout classes in `conversation-home.tsx`. Lock the new structure with source-level regression tests that assert the horizontal shell, fixed-width left column, right-column control order, and isolated scroll viewport.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Arco Design, Node built-in test runner

---

## File Structure

- Modify: `app/(internal)/_components/conversation-home.tsx`
  Responsibility: home page structure, component state, and layout classes.
- Modify: `tests/conversation-home-source.test.ts`
  Responsibility: broad source-level regression coverage for the home page shell and UI contracts.
- Modify: `tests/conversation-home-pagination-source.test.ts`
  Responsibility: source-level regression coverage for search, pagination, and list ordering.

## Chunk 1: Lock The New Layout Contract In Tests

### Task 1: Update the broad home page source assertions

**Files:**
- Modify: `tests/conversation-home-source.test.ts`
- Reference: `app/(internal)/_components/conversation-home.tsx`

- [ ] **Step 1: Write the failing test expectations for the two-column shell**

Add or replace assertions so the source test checks for all of these concrete markers:

```ts
assert.match(source, /flex-1 min-h-0 flex gap-4/);
assert.match(source, /w-\[340px\] shrink-0/);
assert.match(source, /flex-1 min-w-0 min-h-0/);
assert.match(source, /data-layout="home-main-columns"/);
assert.match(source, /data-layout="home-left-panel"/);
assert.match(source, /data-layout="home-right-panel"/);
assert.match(source, /data-layout="home-list-viewport"/);
assert.match(source, /overflow-y-auto/);
```

Also replace outdated expectations that only fit the old stacked layout, especially any source pattern that assumes the main cards are rendered inside one top-to-bottom `Space` wrapper.

- [ ] **Step 2: Run the targeted source tests to verify they fail for the right reason**

Run:

```bash
npm run test:node -- tests/conversation-home-source.test.ts tests/conversation-home-pagination-source.test.ts
```

Expected:

- `tests/conversation-home-source.test.ts` fails because the new two-column layout markers are not present yet.
- `tests/conversation-home-pagination-source.test.ts` may still pass until its own ordering assertions are tightened in Task 2.

- [ ] **Step 3: Keep the failure output notes in the working session**

Confirm the failure is due to missing layout strings in `conversation-home.tsx`, not a broken test regex or syntax error.

### Task 2: Tighten the search/pagination/list ordering test

**Files:**
- Modify: `tests/conversation-home-pagination-source.test.ts`
- Reference: `app/(internal)/_components/conversation-home.tsx`

- [ ] **Step 1: Write the failing order assertions**

Add source assertions that check the right-column control flow in order:

```ts
assert.match(source, /placeholder="按标题搜索会话"/);
assert.match(source, /data-layout="home-right-panel"/);
assert.match(source, /data-layout="home-list-controls"/);
assert.match(source, /data-layout="home-list-pagination"/);
assert.match(source, /data-layout="home-list-viewport"/);
assert.match(
  source,
  /placeholder="按标题搜索会话"[\s\S]*data-layout="home-list-pagination"[\s\S]*data-layout="home-list-viewport"/,
);
```

Keep the existing pagination and search-query assertions that validate `PAGE_SIZE`, `currentPage`, `searchQuery`, and `showTotal`.

- [ ] **Step 2: Run the targeted source tests again to verify the new assertions fail**

Run:

```bash
npm run test:node -- tests/conversation-home-source.test.ts tests/conversation-home-pagination-source.test.ts
```

Expected:

- both tests fail because the current component still uses the old top-to-bottom layout and places pagination beneath the list items.

- [ ] **Step 3: Verify the failures are specifically about layout order**

Confirm the failing lines mention missing `data-layout` markers, missing fixed-width shell classes, or the old ordering around pagination and list markup.

## Chunk 2: Refactor The Home Page JSX Into The Desktop Two-Column Shell

### Task 3: Restructure the outer shell and left action panel

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Test: `tests/conversation-home-source.test.ts`

- [ ] **Step 1: Write the minimal outer-shell implementation**

Replace the stacked main content wrapper with a horizontal flex row that keeps the settings FAB, modal, and navigation overlay behavior untouched.

The core target structure should look like:

```tsx
<div className={shellClassName}>
  <div className="fixed right-6 bottom-[16vh] z-[12]" data-layout="home-settings-fab">
    ...
  </div>
  <div className="relative z-[1] flex flex-1 min-h-0 gap-4" data-layout="home-main-columns">
    <Card
      className={`internal-panel ${accentSurfaceClassName} w-[340px] shrink-0`}
      style={pageCardStyle}
      data-layout="home-left-panel"
    >
      ...
    </Card>
    <Card
      className={`internal-panel ${softSurfaceClassName} flex-1 min-w-0 min-h-0`}
      style={pageCardStyle}
      data-layout="home-right-panel"
    >
      ...
    </Card>
  </div>
</div>
```

Keep `shellClassName` full-height-friendly. If needed, extend it from `min-h-screen` to also include `h-screen` or `min-h-0` only if the surrounding app shell requires it and tests remain aligned with the actual source.

- [ ] **Step 2: Move the title, count tag, actions, and error state into the left panel**

Keep these existing elements in the left panel:

- total-count/loading `Tag`
- page `Title`
- create button
- clear-all-data button
- page-level `Alert`

Remove the search input from the left panel entirely.

- [ ] **Step 3: Run the targeted tests**

Run:

```bash
npm run test:node -- tests/conversation-home-source.test.ts tests/conversation-home-pagination-source.test.ts
```

Expected:

- the broad source test may still fail because the right-panel control order and scroll viewport are not implemented yet.

### Task 4: Build the right panel controls and isolated list viewport

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Test: `tests/conversation-home-source.test.ts`
- Test: `tests/conversation-home-pagination-source.test.ts`

- [ ] **Step 1: Implement the right panel as a vertical flex container**

Refactor the right card body so it contains:

```tsx
<div className="flex h-full min-h-0 flex-col" data-layout="home-right-panel">
  <div className="flex flex-col gap-3" data-layout="home-list-controls">
    <Input ... placeholder="按标题搜索会话" />
    {totalCount > PAGE_SIZE ? (
      <div data-layout="home-list-pagination">
        <Pagination ... />
      </div>
    ) : null}
  </div>
  <div className="flex-1 min-h-0 overflow-y-auto" data-layout="home-list-viewport">
    ...
  </div>
</div>
```

Use `min-h-0` on every parent that needs to allow the viewport to shrink. Keep the empty state in the right panel content region. When items exist, render the cards inside the list viewport so only that area scrolls.

- [ ] **Step 2: Keep pagination above the list cards**

Move the existing `<Pagination />` block from below the mapped cards into the control area above the list viewport.

Retain:

- `current={currentPage}`
- `pageSize={PAGE_SIZE}`
- `total={totalCount}`
- `size="small"`
- `showTotal`
- `onChange={(page) => setCurrentPage(page)}`

- [ ] **Step 3: Preserve the list item card behavior without altering handlers**

Keep the existing item-card rendering, including:

- `openConversation(item)`
- rename button and modal trigger
- delete `Popconfirm`
- date text
- preview paragraph

Only move the surrounding wrappers needed to make the list viewport scroll in isolation.

- [ ] **Step 4: Run the targeted source tests and verify they pass**

Run:

```bash
npm run test:node -- tests/conversation-home-source.test.ts tests/conversation-home-pagination-source.test.ts
```

Expected:

- both targeted tests pass
- failures, if any, point to exact missing layout markers or ordering mismatches in the new JSX

## Chunk 3: Final Verification And Wrap-Up

### Task 5: Run the broader Node test suite for regression confidence

**Files:**
- Verify: `tests/*.ts`

- [ ] **Step 1: Run the full Node test suite**

Run:

```bash
npm run test:node
```

Expected:

- all existing Node tests pass

If unrelated pre-existing failures appear, capture them explicitly before considering the layout work complete.

- [ ] **Step 2: Inspect the final diff for scope control**

Run:

```bash
git diff -- app/(internal)/_components/conversation-home.tsx tests/conversation-home-source.test.ts tests/conversation-home-pagination-source.test.ts
```

Expected:

- diff is limited to the home page layout refactor and its source-level regression tests
- no unrelated data-layer or Tauri files are modified

- [ ] **Step 3: Commit the implementation**

Run:

```bash
git add -- app/(internal)/_components/conversation-home.tsx tests/conversation-home-source.test.ts tests/conversation-home-pagination-source.test.ts
git commit -m "feat: refactor home page into desktop two-column layout"
```

Expected:

- one focused commit containing only the layout refactor and matching tests
