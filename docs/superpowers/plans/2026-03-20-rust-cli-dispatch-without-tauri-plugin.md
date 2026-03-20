# Rust CLI Dispatch Without Tauri Plugin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `tauri-plugin-cli` and `plugins.cli` while keeping the packaged `ai-drawio` command surface, JSON behavior, completions, DMG bundle layout, and PATH install flow unchanged.

**Architecture:** Keep the current single packaged binary and move all terminal command parsing and dispatch into the existing Rust CLI modules. `src-tauri/src/main.rs` should only decide between “run CLI and exit” versus “start Tauri GUI”, while `src-tauri/src/cli_schema.rs` remains the clap source of truth and `src-tauri/src/packaged_cli.rs` remains the runtime dispatcher.

**Tech Stack:** Rust, clap, clap_complete, Tauri v2, Node test runner, existing packaged control server protocol.

---

## File Map

**Modify:**

- `src-tauri/Cargo.toml`
  Remove the `tauri-plugin-cli` crate while keeping clap and completion generation dependencies.
- `src-tauri/tauri.conf.json`
  Remove the `plugins.cli` block and keep `mainBinaryName`, bundle resources, and bundled completion file mappings intact.
- `src-tauri/src/main.rs`
  Remove `.plugin(tauri_plugin_cli::init())` and keep `packaged_cli::maybe_run_from_env()` as the startup gate before GUI launch.
- `src-tauri/src/packaged_cli.rs`
  Add any small pure helper needed to test “no args means GUI launch” behavior without depending on live process args; keep command parsing, JSON printing, and control-server routing unchanged.
- `tests/tauri-cli-config-source.test.ts`
  Replace plugin-configuration assertions with no-plugin architecture assertions.
- `tests/packaged-tauri-cli-source.test.ts`
  Update source assertions to require Rust-only command dispatch and forbid plugin registration or plugin config.

**Verify only:**

- `src-tauri/src/cli_schema.rs`
  Confirm it remains the single clap source of truth and still drives completion generation.
- `src-tauri/build.rs`
  Confirm completions are still generated from `cli_schema::build_cli_command()`.
- `README.md`
  Confirm user-facing command examples remain unchanged.
- `src-tauri/src/cli_path_install.rs`
  Confirm PATH installation still points to the packaged `ai-drawio` binary and bundled completion assets.

## Chunk 1: Remove Plugin Dependency And Config

### Task 1: Rewrite source-level architecture tests first

**Files:**
- Modify: `tests/tauri-cli-config-source.test.ts`
- Modify: `tests/packaged-tauri-cli-source.test.ts`
- Verify: `src-tauri/Cargo.toml`
- Verify: `src-tauri/tauri.conf.json`
- Verify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write the failing Node assertions for the new no-plugin architecture**

Update `tests/tauri-cli-config-source.test.ts` to assert the inverse of the current plugin-based shape:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const TAURI_CONFIG_PATH = new URL('../src-tauri/tauri.conf.json', import.meta.url);
const CARGO_TOML_PATH = new URL('../src-tauri/Cargo.toml', import.meta.url);
const MAIN_SOURCE_PATH = new URL('../src-tauri/src/main.rs', import.meta.url);

test('rust cli dispatch does not rely on tauri plugin cli config', async () => {
  const [tauriConfigText, cargoToml, mainSource] = await Promise.all([
    readFile(TAURI_CONFIG_PATH, 'utf8'),
    readFile(CARGO_TOML_PATH, 'utf8'),
    readFile(MAIN_SOURCE_PATH, 'utf8')
  ]);

  const tauriConfig = JSON.parse(tauriConfigText);

  assert.equal(tauriConfig.plugins?.cli, undefined);
  assert.doesNotMatch(cargoToml, /tauri-plugin-cli\s*=/);
  assert.match(mainSource, /packaged_cli::maybe_run_from_env/);
  assert.doesNotMatch(mainSource, /tauri_plugin_cli::init/);
});
```

Update `tests/packaged-tauri-cli-source.test.ts` to keep the Rust parser/completion assertions but invert the plugin-specific checks:

```ts
assert.doesNotMatch(cargoToml, /tauri-plugin-cli\s*=/);
assert.doesNotMatch(mainSource, /tauri_plugin_cli::init/);
assert.doesNotMatch(tauriConfig, /"plugins"\s*:\s*\{/);
assert.doesNotMatch(tauriConfig, /"cli"\s*:/);
assert.match(mainSource, /packaged_cli::maybe_run_from_env/);
assert.match(cliSchemaSource, /Command::new\("open"\)/);
assert.match(buildSource, /generate_to/);
```

- [ ] **Step 2: Run the Node source tests to verify they fail for the right reason**

Run:

```bash
node --experimental-strip-types --test tests/tauri-cli-config-source.test.ts tests/packaged-tauri-cli-source.test.ts
```

Expected:

- FAIL because `tauri-plugin-cli` still exists in `src-tauri/Cargo.toml`
- FAIL because `tauri_plugin_cli::init()` still exists in `src-tauri/src/main.rs`
- FAIL because `plugins.cli` still exists in `src-tauri/tauri.conf.json`

- [ ] **Step 3: Remove the plugin dependency and plugin config with the smallest possible production change**

Apply these minimal code edits:

In `src-tauri/Cargo.toml`, remove:

```toml
tauri-plugin-cli = "2"
```

In `src-tauri/tauri.conf.json`, remove the entire `plugins` block:

```json
"plugins": {
  "cli": {
    "...": "..."
  }
}
```

Do not change:

- `"mainBinaryName": "ai-drawio"`
- `"bundle.resources"`
- `"bundle.macOS.files"`

In `src-tauri/src/main.rs`, remove only the plugin registration line:

```rust
.plugin(tauri_plugin_cli::init())
```

Keep:

```rust
if let Some(exit_code) = packaged_cli::maybe_run_from_env() {
    std::process::exit(exit_code);
}
```

- [ ] **Step 4: Run the Node source tests again to verify the no-plugin architecture passes**

Run:

```bash
node --experimental-strip-types --test tests/tauri-cli-config-source.test.ts tests/packaged-tauri-cli-source.test.ts
```

Expected:

- PASS
- No assertion mentions `plugins.cli`
- No assertion mentions `tauri_plugin_cli::init`

- [ ] **Step 5: Run a targeted Rust compile check**

Run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected:

- PASS
- No unresolved import or missing crate errors for `tauri_plugin_cli`

- [ ] **Step 6: Commit the dependency/config cleanup**

Run:

```bash
git add src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/src/main.rs tests/tauri-cli-config-source.test.ts tests/packaged-tauri-cli-source.test.ts
git commit -m "refactor: remove tauri cli plugin dependency"
```

## Chunk 2: Lock In Rust-Only Dispatch Semantics

### Task 2: Add failing Rust tests for CLI gate behavior before touching runtime logic

**Files:**
- Modify: `src-tauri/src/packaged_cli.rs`
- Verify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write the failing Rust tests for the startup decision boundary**

Add pure tests in `src-tauri/src/packaged_cli.rs` that force the module to expose a small testable gate around raw args. The tests should prove:

- empty args means “not a CLI invocation”
- non-empty args means “CLI invocation”
- parsing still resolves `open`, `session`, and `canvas` the same way

Add tests shaped like:

```rust
#[test]
fn detects_empty_args_as_gui_launch() {
    let args: Vec<String> = vec![];
    assert!(!should_run_cli_from_args(&args));
}

#[test]
fn detects_non_empty_args_as_cli_launch() {
    let args = vec!["status".to_string()];
    assert!(should_run_cli_from_args(&args));
}
```

If a new helper is needed, keep it pure and local to `packaged_cli.rs`.

- [ ] **Step 2: Run the targeted Rust test selection to verify the new tests fail correctly**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml packaged_cli::tests::detects_empty_args_as_gui_launch
```

Expected:

- FAIL because `should_run_cli_from_args` or equivalent helper does not exist yet

- [ ] **Step 3: Implement the minimal helper and wire `maybe_run_from_env()` through it**

Add a minimal pure helper such as:

```rust
fn should_run_cli_from_args(args: &[String]) -> bool {
    !args.is_empty()
}
```

Then make `maybe_run_from_env()` use that helper:

```rust
pub fn maybe_run_from_env() -> Option<i32> {
    let args = env::args().skip(1).collect::<Vec<_>>();
    if !should_run_cli_from_args(&args) {
        return None;
    }

    // existing parse + execute + print flow stays unchanged
}
```

Do not change:

- JSON printing
- exit code mapping
- open-command launch behavior
- control-server request routing

- [ ] **Step 4: Run the targeted Rust tests again**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml packaged_cli::tests::detects_empty_args_as_gui_launch
cargo test --manifest-path src-tauri/Cargo.toml packaged_cli::tests::detects_non_empty_args_as_cli_launch
```

Expected:

- PASS

- [ ] **Step 5: Run the broader packaged CLI Rust tests to guard against command drift**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml packaged_cli
```

Expected:

- PASS
- existing parser tests for `open`, `session open`, `document.preview`, `document.apply`, and `document.restore` remain green

- [ ] **Step 6: Commit the Rust-only dispatch guard**

Run:

```bash
git add src-tauri/src/packaged_cli.rs
git commit -m "test: lock rust cli dispatch semantics"
```

## Chunk 3: Verify Packaging, Completions, And Docs Stay Stable

### Task 3: Add failing source assertions for retained bundle and completion behavior

**Files:**
- Modify: `tests/packaged-tauri-cli-source.test.ts`
- Verify: `src-tauri/build.rs`
- Verify: `src-tauri/src/cli_schema.rs`
- Verify: `src-tauri/src/cli_path_install.rs`
- Verify: `README.md`

- [ ] **Step 1: Extend the Node source test with explicit non-regression assertions**

Add or keep assertions like:

```ts
assert.match(buildSource, /generate_to/);
assert.match(buildSource, /cli_schema::build_cli_command/);
assert.match(tauriConfig, /"mainBinaryName"\s*:\s*"ai-drawio"/);
assert.match(tauriConfig, /"SharedSupport\/cli-completions\/_ai-drawio"/);
assert.match(tauriConfig, /"SharedSupport\/cli-completions\/ai-drawio\.bash"/);
assert.match(tauriConfig, /"SharedSupport\/cli-completions\/ai-drawio\.fish"/);
assert.match(readme, /Install ai-drawio into PATH/);
assert.match(readme, /ai-drawio open --mode window/);
```

- [ ] **Step 2: Run the Node source test to verify at least one new assertion fails before implementation if you added a brand-new check**

Run:

```bash
node --experimental-strip-types --test tests/packaged-tauri-cli-source.test.ts
```

Expected:

- If a new assertion references a missing literal, it should fail for that exact reason
- Otherwise, document that the new checks are already green because the behavior was preserved by design

- [ ] **Step 3: Keep production files unchanged unless a retained-path assertion exposed a real regression**

Only if required by a failing retained-path assertion, make the minimal fix in:

- `src-tauri/build.rs`
- `src-tauri/tauri.conf.json`
- `README.md`

Do not rewrite command examples or bundle paths unless they actually drifted.

- [ ] **Step 4: Run the full Node test suite for CLI-adjacent source coverage**

Run:

```bash
node --experimental-strip-types --test tests/tauri-cli-config-source.test.ts tests/packaged-tauri-cli-source.test.ts tests/ai-drawio-cli-source.test.ts tests/dmg-cli-install-source.test.ts tests/cli-install-status-source.test.ts
```

Expected:

- PASS
- no plugin-based assertion failures
- no PATH install regressions

- [ ] **Step 5: Run the project Node regression entrypoint**

Run:

```bash
npm run test:node
```

Expected:

- PASS
- no regressions outside the focused CLI migration area

- [ ] **Step 6: Commit the verification and non-regression updates**

Run:

```bash
git add tests/packaged-tauri-cli-source.test.ts README.md src-tauri/build.rs src-tauri/src/cli_schema.rs src-tauri/src/cli_path_install.rs
git commit -m "test: preserve packaged cli behavior without plugin"
```

## Chunk 4: Final Verification And Handoff

### Task 4: Produce final evidence before implementation handoff completion

**Files:**
- Verify only: `src-tauri/Cargo.toml`
- Verify only: `src-tauri/tauri.conf.json`
- Verify only: `src-tauri/src/main.rs`
- Verify only: `src-tauri/src/packaged_cli.rs`
- Verify only: `tests/tauri-cli-config-source.test.ts`
- Verify only: `tests/packaged-tauri-cli-source.test.ts`

- [ ] **Step 1: Run final Rust verification**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected:

- PASS

- [ ] **Step 2: Run final Node verification**

Run:

```bash
npm run test:node
```

Expected:

- PASS

- [ ] **Step 3: Run a final compile check for release-oriented bundle inputs**

Run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected:

- PASS

- [ ] **Step 4: Inspect the final diff for architectural intent**

Run:

```bash
git diff --stat HEAD~3..HEAD
```

Expected:

- `tauri-plugin-cli` removed from Cargo
- `plugins.cli` removed from Tauri config
- `tauri_plugin_cli::init()` removed from `main.rs`
- clap schema, completion generation, PATH install, and command examples preserved

- [ ] **Step 5: Commit any remaining verification-only touch-ups**

Run:

```bash
git add -A
git commit -m "chore: finalize rust cli dispatch migration"
```

Expected:

- Either a small final commit is created, or there is nothing left to commit

- [ ] **Step 6: Prepare handoff notes**

Record these facts in the execution summary:

- `ai-drawio` remains a single packaged binary
- Rust now owns all CLI dispatch
- `tauri-plugin-cli` and `plugins.cli` are removed
- command surface and JSON outputs are unchanged
- completions still come from `cli_schema`
- PATH install still points to `/usr/local/bin/ai-drawio`
