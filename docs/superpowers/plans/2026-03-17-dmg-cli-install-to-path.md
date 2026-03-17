# DMG CLI Install To PATH Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the macOS app as a DMG and add an in-app Settings flow that installs `/usr/local/bin/ai-drawio` with administrator approval after drag-and-drop installation.

**Architecture:** Keep the existing packaged Rust CLI binary and completion generation intact, but replace PKG `postinstall` registration with an app-bundled install script invoked from new Tauri commands. Add a Settings page under the internal Next.js app so the frontend can inspect install status and trigger the system-level install flow through Rust.

**Tech Stack:** Tauri 2, Rust, Next.js App Router, React 19, Node test runner, macOS shell scripting

---

## Chunk 1: Lock The New Surface With Source Tests

### Task 1: Add a source test for the new Settings entry and route

**Files:**
- Create: `tests/settings-page-source.test.ts`
- Test: `app/(internal)/_components/conversation-home.tsx`
- Test: `app/(internal)/settings/page.tsx`
- Test: `app/(internal)/_components/settings-page.tsx`

- [ ] **Step 1: Write the failing test**

```ts
test("home page links to settings and settings page renders cli integration actions", async () => {
  const [homeSource, routeSource, settingsSource] = await Promise.all([
    readFile(HOME_SOURCE_PATH, "utf8"),
    readFile(SETTINGS_ROUTE_PATH, "utf8"),
    readFile(SETTINGS_COMPONENT_PATH, "utf8"),
  ]);

  assert.match(homeSource, /设置/);
  assert.match(homeSource, /router\.push\(["'`]\/settings["'`]\)/);
  assert.match(routeSource, /SettingsPage/);
  assert.match(settingsSource, /CLI Integration|CLI 集成/);
  assert.match(settingsSource, /Install ai-drawio into PATH/);
  assert.match(settingsSource, /Reinstall ai-drawio into PATH/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/settings-page-source.test.ts`
Expected: FAIL because the settings route and settings UI do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create the new route and component shells, and add a home-page Settings entry that navigates to `/settings`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/settings-page-source.test.ts`
Expected: PASS

### Task 2: Add a source test for Tauri CLI install commands and bundled resources

**Files:**
- Create: `tests/dmg-cli-install-source.test.ts`
- Test: `src-tauri/src/main.rs`
- Test: `src-tauri/src/cli_path_install.rs`
- Test: `src-tauri/tauri.conf.json`
- Test: `src-tauri/build.rs`
- Test: `src-tauri/resources/macos/install-cli-to-path.sh`
- Test: `package.json`
- Test: `README.md`

- [ ] **Step 1: Write the failing test**

```ts
test("tauri exposes dmg cli install commands and bundles install resources", async () => {
  const [mainSource, configSource, buildSource, packageJson, readme, installSource] =
    await Promise.all([
      readFile(MAIN_SOURCE_PATH, "utf8"),
      readFile(TAURI_CONFIG_PATH, "utf8"),
      readFile(BUILD_SOURCE_PATH, "utf8"),
      readFile(PACKAGE_JSON_PATH, "utf8"),
      readFile(README_PATH, "utf8"),
      readFile(INSTALL_SCRIPT_PATH, "utf8"),
    ]);

  assert.match(mainSource, /get_cli_install_status/);
  assert.match(mainSource, /install_cli_to_path/);
  assert.match(configSource, /"targets"\s*:\s*"dmg"|\"targets\"\s*:\s*\[\s*\"dmg\"\s*\]/);
  assert.match(configSource, /install-cli-to-path\.sh/);
  assert.match(configSource, /SharedSupport\/cli-completions/);
  assert.match(buildSource, /generate_to/);
  assert.match(packageJson, /build:macos:dmg/);
  assert.match(readme, /Install ai-drawio into PATH/);
  assert.match(installSource, /\/usr\/local\/bin\/ai-drawio/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/dmg-cli-install-source.test.ts`
Expected: FAIL because the new Tauri commands, bundled script, and DMG build script are not wired yet.

- [ ] **Step 3: Write minimal implementation**

Add the new Rust command module, create the bundled install script, and update DMG-related packaging configuration and docs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/dmg-cli-install-source.test.ts`
Expected: PASS

## Chunk 2: Build The Rust CLI Install Backend

### Task 3: Add Rust tests for install status classification and script path resolution

**Files:**
- Create: `src-tauri/src/cli_path_install.rs`
- Modify: `src-tauri/Cargo.toml`
- Test: `src-tauri/src/cli_path_install.rs`

- [ ] **Step 1: Write the failing Rust tests**

Add unit tests for:

- status is `not_installed` when `/usr/local/bin/ai-drawio` is absent
- status is `installed` when a symlink points to the current app binary
- status is `mismatched` when a symlink points elsewhere
- bundled script path resolution returns the expected resource path suffix
- result shaping preserves separate `command_installed` and `completion_installed` fields

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml cli_path_install -- --nocapture`
Expected: FAIL because `cli_path_install.rs` and its helpers do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement a new Rust module that defines:

- install status enum and serializable response payloads
- symlink inspection helpers
- current app binary path resolution helpers
- bundled resource path resolution helpers
- install result payload mapping

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml cli_path_install -- --nocapture`
Expected: PASS

### Task 4: Add Rust tests for the privileged install execution path

**Files:**
- Modify: `src-tauri/src/cli_path_install.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `src-tauri/src/cli_path_install.rs`

- [ ] **Step 1: Write the failing Rust tests**

Add tests for:

- AppleScript command construction escapes paths safely
- cancelled elevation is mapped to a stable error code
- non-zero installer exit status becomes a structured failure
- successful installer output maps to `ok: true`, `command_installed: true`

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml cli_path_install install_cli -- --nocapture`
Expected: FAIL because privileged execution and error mapping are not implemented yet.

- [ ] **Step 3: Write minimal implementation**

Add:

- `get_cli_install_status` Tauri command
- `install_cli_to_path` Tauri command
- `osascript` elevation wrapper
- stdout/stderr parsing and structured error mapping
- command registration in `src-tauri/src/main.rs`

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml cli_path_install install_cli -- --nocapture`
Expected: PASS

## Chunk 3: Add The Settings Page Frontend

### Task 5: Add a frontend helper for Tauri CLI install APIs

**Files:**
- Create: `app/(internal)/_lib/tauri-cli-install.ts`
- Test: `tests/settings-page-source.test.ts`

- [ ] **Step 1: Write the failing source expectation**

Extend `tests/settings-page-source.test.ts` to check for:

- `invoke("get_cli_install_status")`
- `invoke("install_cli_to_path")`
- a typed response shape used by the settings UI

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/settings-page-source.test.ts`
Expected: FAIL because there is no frontend helper for the new Tauri commands.

- [ ] **Step 3: Write minimal implementation**

Create a small frontend helper that:

- safely imports `@tauri-apps/api/core` only in the client path
- exposes `getCliInstallStatus()`
- exposes `installCliToPath()`
- normalizes missing-Tauri cases into a predictable error for the UI

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/settings-page-source.test.ts`
Expected: PASS

### Task 6: Build the Settings page and home-page entry

**Files:**
- Create: `app/(internal)/settings/page.tsx`
- Create: `app/(internal)/_components/settings-page.tsx`
- Modify: `app/(internal)/_components/conversation-home.tsx`
- Test: `tests/settings-page-source.test.ts`

- [ ] **Step 1: Write the failing source expectation**

Extend `tests/settings-page-source.test.ts` to check for:

- a Settings button on the home page
- a client settings component
- status labels for `未安装` / `已安装` / `安装目标异常`
- action button text for install and reinstall
- success guidance mentioning `ai-drawio status` and `hash -r`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/settings-page-source.test.ts`
Expected: FAIL because the UI states and action copy are not implemented yet.

- [ ] **Step 3: Write minimal implementation**

Implement:

- home-page Settings button that routes to `/settings`
- settings route component under the internal layout
- a `CLI Integration` card that loads status on mount
- install/reinstall button state handling
- inline success and failure feedback based on structured Rust results

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/settings-page-source.test.ts`
Expected: PASS

## Chunk 4: Replace PKG Registration With DMG-Oriented Bundling

### Task 7: Add the bundled installer script and DMG build entry

**Files:**
- Create: `src-tauri/resources/macos/install-cli-to-path.sh`
- Create: `scripts/build-macos-cli-dmg.sh`
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `README.md`
- Test: `tests/dmg-cli-install-source.test.ts`

- [ ] **Step 1: Write the failing source expectation**

Extend `tests/dmg-cli-install-source.test.ts` to check for:

- the bundled installer script resource path
- `/usr/local/bin/ai-drawio` symlink creation logic
- completion destination paths
- `build:macos:dmg` script
- README instructions for drag-and-drop install plus in-app PATH install

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/dmg-cli-install-source.test.ts`
Expected: FAIL because the DMG-oriented script and docs do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:

- a reusable macOS install script bundled into the app resources
- a DMG build shell script that invokes the existing Tauri build for DMG output
- package.json script wiring for the DMG build
- Tauri bundle config updated to include the install script and target DMG
- README updates that remove PKG as the primary CLI registration path

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/dmg-cli-install-source.test.ts`
Expected: PASS

### Task 8: Remove or quarantine the old PKG-specific registration path

**Files:**
- Modify: `scripts/build-macos-cli-pkg.sh`
- Modify: `src-tauri/pkg/macos/scripts/postinstall`
- Modify: `README.md`
- Test: `tests/packaged-tauri-cli-source.test.ts`

- [ ] **Step 1: Write the failing source expectation**

Update `tests/packaged-tauri-cli-source.test.ts` so it no longer requires PKG `postinstall` as the primary installation path and instead asserts that completion generation still exists independently of PKG.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:node -- tests/packaged-tauri-cli-source.test.ts`
Expected: FAIL because the current test still assumes PKG-specific registration.

- [ ] **Step 3: Write minimal implementation**

Adjust the legacy PKG assets so they are no longer treated as the primary install path for this feature. Either:

- remove the PKG-only script references from active docs and tests, or
- leave the files in place but clearly mark them as legacy/non-primary while preserving backward compatibility

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:node -- tests/packaged-tauri-cli-source.test.ts`
Expected: PASS

## Chunk 5: End-To-End Verification

### Task 9: Run focused automated verification

**Files:**
- Test: `tests/settings-page-source.test.ts`
- Test: `tests/dmg-cli-install-source.test.ts`
- Test: `tests/packaged-tauri-cli-source.test.ts`
- Test: `src-tauri/src/cli_path_install.rs`

- [ ] **Step 1: Run the new source-level tests**

Run: `npm run test:node -- tests/settings-page-source.test.ts tests/dmg-cli-install-source.test.ts tests/packaged-tauri-cli-source.test.ts`
Expected: PASS

- [ ] **Step 2: Run nearby frontend regression checks**

Run: `npm run test:node -- tests/conversation-home-source.test.ts tests/internal-shell-bridge-source.test.ts tests/app-startup-loading-front-source.test.ts`
Expected: PASS

- [ ] **Step 3: Run Rust unit tests**

Run: `source ~/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml cli_path_install -- --nocapture`
Expected: PASS

- [ ] **Step 4: Run Rust compile verification**

Run: `source ~/.cargo/env && cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

### Task 10: Run manual macOS packaging verification

**Files:**
- Modify: `scripts/build-macos-cli-dmg.sh`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `README.md`

- [ ] **Step 1: Build the DMG artifact**

Run: `npm run build:macos:dmg`
Expected: PASS and a DMG output under `src-tauri/target/release/bundle/dmg/`

- [ ] **Step 2: Install the app by drag-and-drop**

Manual check:

- mount the generated DMG
- drag `AI Drawio.app` into `/Applications`
- launch the app successfully

- [ ] **Step 3: Verify in-app CLI installation**

Manual check:

- open the home page
- click `设置`
- open the `CLI Integration` card
- click `Install ai-drawio into PATH`
- approve administrator privileges

- [ ] **Step 4: Verify terminal command behavior**

Run in a fresh terminal:

- `which ai-drawio`
- `ai-drawio status`

Expected:

- `which ai-drawio` resolves to `/usr/local/bin/ai-drawio`
- `ai-drawio status` returns structured JSON

## Implementation Notes

- Follow the existing internal app route structure under `app/(internal)/`.
- Keep all source code and scripts in English.
- Keep interactive explanations out of source files.
- Do not add Git or Worktree steps; user explicitly requested not to use them for this task.
- Prefer preserving the existing packaged CLI command model and completion generation instead of introducing a separate installer-only binary.
