# Session Workspace Collapsible Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapse/expand control to the workspace detail page sidebar so the conversation history can be hidden and restored without affecting the canvas session.

**Architecture:** Keep the existing two-column flex shell in `session-workspace.tsx`, add a local `isSidebarCollapsed` boolean, and branch the left column between the current `320px` card and a narrow expand rail. Update the source-level layout test first so the new structure is enforced before implementation.

**Tech Stack:** Next.js App Router, React client components, TypeScript, `@arco-design/web-react`, Node built-in test runner

---

### Task 1: Lock Down the New Sidebar Layout Contract

**Files:**
- Modify: `tests/session-workspace-layout.test.ts`
- Test: `tests/session-workspace-layout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("session workspace supports collapsing the sidebar into a narrow rail", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /const \[isSidebarCollapsed, setIsSidebarCollapsed\] = useState\(false\);/);
  assert.match(source, /data-layout="workspace-sidebar-toggle"/);
  assert.match(source, /setIsSidebarCollapsed\(true\)/);
  assert.match(source, /setIsSidebarCollapsed\(false\)/);
  assert.match(source, /w-\[48px\] shrink-0/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`

Expected: FAIL because `session-workspace.tsx` does not yet define `isSidebarCollapsed`, the toggle layout marker, or the collapsed rail width.

- [ ] **Step 3: Update the existing layout assertions for conditional sidebar markup**

```ts
assert.match(source, /data-layout="workspace-body"/);
assert.match(source, /data-layout="workspace-sidebar"/);
assert.match(source, /data-layout="workspace-sidebar-toggle"/);
assert.match(source, /const \[isSidebarCollapsed, setIsSidebarCollapsed\] = useState\(false\);/);
assert.match(source, /isSidebarCollapsed \?/);
assert.match(source, /w-\[320px\] shrink-0/);
assert.match(source, /w-\[48px\] shrink-0/);
assert.match(source, /setIsSidebarCollapsed\(true\)/);
assert.match(source, /setIsSidebarCollapsed\(false\)/);
assert.doesNotMatch(source, /<div className=\{`\$\{sidebarClassName\} w-\[320px\] shrink-0`\} data-layout="workspace-sidebar">/);
```

- [ ] **Step 4: Run test to verify it still fails for the right reason**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`

Expected: FAIL with missing source matches from the new collapse contract, not with syntax errors in the test file.

- [ ] **Step 5: Commit**

```bash
git add -- tests/session-workspace-layout.test.ts
git commit -m "test: define collapsible workspace sidebar contract"
```

### Task 2: Implement the Collapsible Sidebar UI

**Files:**
- Modify: `app/(internal)/_components/session-workspace.tsx`
- Test: `tests/session-workspace-layout.test.ts`

- [ ] **Step 1: Write the minimal state and toggle UI**

```tsx
const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

const sidebarToggleButton = isSidebarCollapsed ? (
  <Button
    data-layout="workspace-sidebar-toggle"
    type="text"
    size="mini"
    onClick={() => setIsSidebarCollapsed(false)}
  >
    展开
  </Button>
) : (
  <Button
    data-layout="workspace-sidebar-toggle"
    type="text"
    size="mini"
    onClick={() => setIsSidebarCollapsed(true)}
  >
    收起
  </Button>
);
```

- [ ] **Step 2: Branch the left column between expanded card and collapsed rail**

```tsx
{isSidebarCollapsed ? (
  <div className={`${sidebarClassName} w-[48px] shrink-0`} data-layout="workspace-sidebar">
    <div className="internal-panel flex h-full items-start justify-center overflow-hidden bg-transparent px-1 py-3">
      {sidebarToggleButton}
    </div>
  </div>
) : (
  <div className={`${sidebarClassName} w-[320px] shrink-0`} data-layout="workspace-sidebar">
    <Card
      className={`internal-panel overflow-hidden ${sidebarSurfaceClassName}`}
      title="会话记录"
      extra={sidebarToggleButton}
      style={{ ...toolbarCardStyle, height: '100%' }}
    >
      {/* existing history content */}
    </Card>
  </div>
)}
```

- [ ] **Step 3: Keep the existing history body unchanged while wiring the new button placement**

```tsx
bodyStyle={{
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  minHeight: 0,
  height: 'calc(100% - 57px)',
  padding: 18,
}}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test:node -- tests/session-workspace-layout.test.ts`

Expected: PASS with the new collapse markers and both sidebar widths present in source.

- [ ] **Step 5: Commit**

```bash
git add -- tests/session-workspace-layout.test.ts app/\(internal\)/_components/session-workspace.tsx
git commit -m "feat: add collapsible workspace sidebar"
```

### Task 3: Run Regression Verification

**Files:**
- Modify: `none`
- Test: `tests/session-workspace-layout.test.ts`, `tests/session-workspace-clipping.test.ts`, `tests/session-workspace-header-nav.test.ts`

- [ ] **Step 1: Run the focused workspace layout regression suite**

```bash
npm run test:node -- tests/session-workspace-layout.test.ts tests/session-workspace-clipping.test.ts tests/session-workspace-header-nav.test.ts
```

Expected: PASS for all three tests with no new failures.

- [ ] **Step 2: Inspect the final diff**

```bash
git diff -- app/\(internal\)/_components/session-workspace.tsx tests/session-workspace-layout.test.ts
```

Expected: only the sidebar collapse state, toggle markup, and related source assertions are changed.

- [ ] **Step 3: Commit**

```bash
git add -- app/\(internal\)/_components/session-workspace.tsx tests/session-workspace-layout.test.ts
git commit -m "test: verify collapsible workspace sidebar regressions"
```
