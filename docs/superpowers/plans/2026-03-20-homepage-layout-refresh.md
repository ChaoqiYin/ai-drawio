# Homepage Layout Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the internal home page so the left column becomes a visual guidance panel with a single-line headline and inline SVG, while the right column owns search, create, clear, pagination, and the session list.

**Architecture:** Keep all existing `ConversationHome` state transitions and handlers intact, and only refactor JSX structure, copy, and layout classes inside `app/(internal)/_components/conversation-home.tsx`. Protect the new contract with source-level tests that assert the button migration, new left-panel copy, right-panel toolbar structure, and the presence of a dedicated visual container for the inline SVG.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Arco Design, Node built-in test runner

---

## File Structure

- Modify: `app/(internal)/_components/conversation-home.tsx`
  Responsibility: homepage shell, panel layout, copy, inline SVG, and toolbar structure.
- Modify: `tests/conversation-home-source.test.ts`
  Responsibility: broad source-level regression coverage for the home page shell, copy, action placement, and visual container markers.
- Modify: `tests/conversation-home-pagination-source.test.ts`
  Responsibility: source-level regression coverage for the right-panel control flow and list-region ordering.

## Chunk 1: Lock The New Layout Contract In Tests

### Task 1: Tighten the broad home page source assertions

**Files:**
- Modify: `tests/conversation-home-source.test.ts`
- Reference: `app/(internal)/_components/conversation-home.tsx`

- [ ] **Step 1: Write the failing assertions for the new left panel contract**

Add or replace assertions so the source test checks for these concrete markers:

```ts
assert.match(source, /继续你的绘图工作/);
assert.match(source, /选择一个会话，回到上次的画布。/);
assert.match(source, /data-layout="home-left-copy"/);
assert.match(source, /data-layout="home-left-visual"/);
assert.match(source, /<svg[\s\S]*viewBox=/);
assert.doesNotMatch(
  source,
  /data-layout="home-left-panel"[\s\S]*创建本地会话[\s\S]*清空全部本地数据/,
);
```

Also remove outdated expectations that assume the left panel still renders the primary action stack.

- [ ] **Step 2: Write the failing assertions for the right-panel toolbar**

Add explicit right-panel control assertions such as:

```ts
assert.match(source, /data-layout="home-list-toolbar"/);
assert.match(source, /data-layout="home-list-toolbar-actions"/);
assert.match(source, /placeholder="按标题搜索会话"/);
assert.match(source, /创建本地会话/);
assert.match(source, /清空全部本地数据/);
assert.match(
  source,
  /placeholder="按标题搜索会话"[\s\S]*data-layout="home-list-toolbar-actions"[\s\S]*创建本地会话[\s\S]*清空全部本地数据/,
);
```

- [ ] **Step 3: Run the targeted tests to verify they fail**

Run:

```bash
node --experimental-strip-types --test \
  tests/conversation-home-source.test.ts \
  tests/conversation-home-pagination-source.test.ts
```

Expected:

- `tests/conversation-home-source.test.ts` fails because the new copy, toolbar, and visual markers are not present yet.
- `tests/conversation-home-pagination-source.test.ts` may still fail after Task 2 adds stronger ordering assertions.

### Task 2: Tighten the search, toolbar, pagination, and list ordering test

**Files:**
- Modify: `tests/conversation-home-pagination-source.test.ts`
- Reference: `app/(internal)/_components/conversation-home.tsx`

- [ ] **Step 1: Write the failing order assertions**

Update the test so it locks the new right-column structure in order:

```ts
assert.match(source, /data-layout="home-right-panel"/);
assert.match(source, /data-layout="home-list-toolbar"/);
assert.match(source, /data-layout="home-list-toolbar-actions"/);
assert.match(source, /data-layout="home-list-pagination"/);
assert.match(source, /data-layout="home-list-viewport"/);
assert.match(
  source,
  /placeholder="按标题搜索会话"[\s\S]*data-layout="home-list-toolbar-actions"[\s\S]*data-layout="home-list-pagination"[\s\S]*data-layout="home-list-viewport"/,
);
```

Keep the existing assertions for `PAGE_SIZE`, `currentPage`, `searchQuery`, `showTotal`, and `setCurrentPage(1)`.

- [ ] **Step 2: Run the targeted tests again to verify they fail for the right reason**

Run:

```bash
node --experimental-strip-types --test \
  tests/conversation-home-source.test.ts \
  tests/conversation-home-pagination-source.test.ts
```

Expected:

- both tests fail because the source still reflects the old action placement and missing visual block.

- [ ] **Step 3: Verify the failures are structural**

Confirm the failure output mentions missing `data-layout` markers, missing new copy, or missing inline SVG structure, not test syntax errors.

## Chunk 2: Refactor The Home Page JSX And Visual Treatment

### Task 3: Convert the left panel into guidance copy plus inline SVG

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Test: `tests/conversation-home-source.test.ts`

- [ ] **Step 1: Replace the left-panel content block**

Refactor the left card body so it becomes a guidance panel with two explicit sections:

```tsx
<div className="flex h-full flex-col gap-5">
  <div className="flex flex-col gap-2" data-layout="home-left-copy">
    <Text ...>Workspace</Text>
    <Title heading={3} ...>继续你的绘图工作</Title>
    <Paragraph ...>选择一个会话，回到上次的画布。</Paragraph>
  </div>
  <div className="flex-1 min-h-0" data-layout="home-left-visual">
    <svg viewBox="0 0 320 240" ...>...</svg>
  </div>
  {error ? <Alert ... /> : null}
</div>
```

Key constraints:

- Remove the left-panel create and clear buttons entirely.
- Keep the page-level `Alert` in the left panel.
- Keep the title visually single-line by using shorter copy and width-safe layout; do not rely on awkward font shrinking.

- [ ] **Step 2: Implement the inline SVG**

Use a low-contrast blue-gray abstract SVG with rounded cards, nodes, connectors, and soft gradients. Keep it inline in `conversation-home.tsx`, decorative only, and avoid any text labels inside the SVG so the visual stays language-neutral.

- [ ] **Step 3: Preserve existing state and helpers**

Do not remove:

- `handleCreateConversation`
- `handleClearAllData`
- `error`
- `isNavigating`
- `isClearingAll`

These still power the right-side buttons and overlay behavior.

- [ ] **Step 4: Run the targeted tests**

Run:

```bash
node --experimental-strip-types --test \
  tests/conversation-home-source.test.ts \
  tests/conversation-home-pagination-source.test.ts
```

Expected:

- source tests may still fail until the right toolbar is fully implemented in Task 4.

### Task 4: Move the primary actions into the right toolbar and keep list flow intact

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Test: `tests/conversation-home-source.test.ts`
- Test: `tests/conversation-home-pagination-source.test.ts`

- [ ] **Step 1: Split the right-panel controls into toolbar plus pagination row**

Implement a structure like:

```tsx
<div className="flex h-full min-h-0 flex-col">
  <div className="flex flex-col gap-3" data-layout="home-list-controls">
    <div className="flex flex-wrap items-center gap-3" data-layout="home-list-toolbar">
      <Input ... />
      <div className="ml-auto flex flex-wrap items-center gap-2" data-layout="home-list-toolbar-actions">
        <Button ...>创建本地会话</Button>
        <Popconfirm ...>
          <Button ...>清空全部本地数据</Button>
        </Popconfirm>
      </div>
    </div>
    <div data-layout="home-list-pagination">
      {totalCount > PAGE_SIZE ? <Pagination ... /> : null}
    </div>
  </div>
  <div className="flex-1 min-h-0 overflow-y-auto pt-3" data-layout="home-list-viewport">
    ...
  </div>
</div>
```

Constraints:

- Search remains on the left side of the toolbar.
- Actions move to the right side of the toolbar.
- Pagination stays below the toolbar, above the list viewport.

- [ ] **Step 2: Reuse the existing handlers without behavior changes**

Wire the toolbar buttons back to the current logic:

- `onClick={handleCreateConversation}`
- `onOk={handleClearAllData}`
- disabled/loading rules remain tied to `isNavigating`, `isPending`, and `isClearingAll`

Do not change delete, rename, card click, or overlay behavior.

- [ ] **Step 3: Keep the empty state and list viewport structure stable**

Keep:

- the empty state in `data-layout="home-list-viewport"`
- the mapped session cards inside the scrollable viewport
- the existing card body metadata and preview paragraph

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run:

```bash
node --experimental-strip-types --test \
  tests/conversation-home-source.test.ts \
  tests/conversation-home-pagination-source.test.ts
```

Expected:

- both tests pass.

## Chunk 3: Full Verification And Cleanup

### Task 5: Run the broader verification and inspect the final diff

**Files:**
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Modify: `tests/conversation-home-source.test.ts`
- Modify: `tests/conversation-home-pagination-source.test.ts`

- [ ] **Step 1: Run the repository node test suite**

Run:

```bash
npm run test:node
```

Expected:

- PASS with zero failures.

- [ ] **Step 2: Review the diff**

Run:

```bash
git diff -- \
  'app/(internal)/_components/conversation-home.tsx' \
  'tests/conversation-home-source.test.ts' \
  'tests/conversation-home-pagination-source.test.ts'
```

Confirm the diff only contains:

- left-panel copy refresh
- inline SVG addition
- right-toolbar action migration
- updated source assertions

- [ ] **Step 3: Prepare the implementation summary**

Note the user-visible changes, the tests run, and any residual UI risk such as toolbar wrap behavior on narrower widths.
