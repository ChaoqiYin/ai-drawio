# App Startup Loading Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native startup loading screen that covers the blank startup gap until the frontend first mounts.

**Architecture:** Tauri owns a dedicated splash window and keeps the main window hidden on launch. A minimal client component mounted from the root layout reports the first frontend render back to Rust, which then closes the splash window and reveals the main window.

**Tech Stack:** Tauri 2, Rust, Next.js App Router, React 19, Node test runner

---

## Chunk 1: Startup Contract Tests

### Task 1: Add a Rust startup source test

**Files:**
- Test: `tests/app-startup-loading-tauri-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("tauri startup defines splash loading lifecycle", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /app_ready/);
  assert.match(source, /get_webview_window\("main"\)/);
  assert.match(source, /get_webview_window\("splash"\)/);
  assert.match(source, /show\(\)/);
  assert.match(source, /close\(\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/app-startup-loading-tauri-source.test.ts`
Expected: FAIL because startup loading lifecycle does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a Tauri command and setup logic for splash visibility.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/app-startup-loading-tauri-source.test.ts`
Expected: PASS

### Task 2: Add a frontend startup reporter source test

**Files:**
- Test: `tests/app-startup-loading-front-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("root layout mounts a startup ready reporter", async () => {
  const layoutSource = await readFile(LAYOUT_PATH, "utf8");
  const componentSource = await readFile(COMPONENT_PATH, "utf8");

  assert.match(layoutSource, /AppStartupReady/);
  assert.match(componentSource, /useEffect/);
  assert.match(componentSource, /invoke/);
  assert.match(componentSource, /app_ready/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/app-startup-loading-front-source.test.ts`
Expected: FAIL because no startup reporter exists yet.

- [ ] **Step 3: Write minimal implementation**

Add the startup-ready client component and mount it in the root layout.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/app-startup-loading-front-source.test.ts`
Expected: PASS

## Chunk 2: Native Startup Loading

### Task 3: Implement splash lifecycle in Tauri

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add splash window config**
- [ ] **Step 2: Add startup-ready command**
- [ ] **Step 3: Hide main window during setup and keep splash visible**
- [ ] **Step 4: On startup-ready, show main and close splash**

## Chunk 3: Frontend Startup Signal

### Task 4: Report first render from the root layout

**Files:**
- Create: `app/_components/app-startup-ready.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create a client component with a one-time `useEffect`**
- [ ] **Step 2: Invoke the Tauri `app_ready` command when available**
- [ ] **Step 3: Mount the component in the root layout**

## Chunk 4: Verification

### Task 5: Run focused verification

**Files:**
- Test: `tests/app-startup-loading-tauri-source.test.ts`
- Test: `tests/app-startup-loading-front-source.test.ts`

- [ ] **Step 1: Run startup loading tests**

Run: `npm run test:node -- tests/app-startup-loading-tauri-source.test.ts tests/app-startup-loading-front-source.test.ts`
Expected: PASS

- [ ] **Step 2: Run nearby regression checks**

Run: `npm run test:node -- tests/tauri-devtools-source.test.ts tests/internal-shell-bridge-source.test.ts`
Expected: PASS
