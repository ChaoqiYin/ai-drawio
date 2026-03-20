import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CLI_SKILL_PATH = new URL("../skills/ai-drawio-cli/SKILL.md", import.meta.url);
const CLI_OPEN_REFERENCE_PATH = new URL("../skills/ai-drawio-cli/references/open.md", import.meta.url);
const CLI_STATUS_REFERENCE_PATH = new URL("../skills/ai-drawio-cli/references/status.md", import.meta.url);
const CLI_PREVIEW_REFERENCE_PATH = new URL(
  "../skills/ai-drawio-cli/references/canvas-document-preview.md",
  import.meta.url
);
const CLI_APPLY_REFERENCE_PATH = new URL(
  "../skills/ai-drawio-cli/references/canvas-document-apply.md",
  import.meta.url
);
const CLI_AGENT_PATH = new URL("../skills/ai-drawio-cli/agents/openai.yaml", import.meta.url);
const CLI_SCHEMA_PATH = new URL("../src-tauri/src/cli_schema.rs", import.meta.url);

test("ai-drawio cli skill covers the current command surface and session-scoped concurrency", async () => {
  const [
    skillSource,
    openReferenceSource,
    statusReferenceSource,
    previewReferenceSource,
    applyReferenceSource,
    agentSource,
    schemaSource
  ] = await Promise.all([
    readFile(CLI_SKILL_PATH, "utf8"),
    readFile(CLI_OPEN_REFERENCE_PATH, "utf8"),
    readFile(CLI_STATUS_REFERENCE_PATH, "utf8"),
    readFile(CLI_PREVIEW_REFERENCE_PATH, "utf8"),
    readFile(CLI_APPLY_REFERENCE_PATH, "utf8"),
    readFile(CLI_AGENT_PATH, "utf8"),
    readFile(CLI_SCHEMA_PATH, "utf8")
  ]);

  assert.match(skillSource, /Every `canvas document\.apply` command must include a required prompt argument with the user request summary\./);
  assert.match(skillSource, /Do not generate a `\.drawio` file unless the user explicitly asked for file output or the XML payload is too large for a safe inline command\./);
  assert.match(skillSource, /Use `session create` when the user needs a new ready session\./);
  assert.match(skillSource, /Do not execute any `ai-drawio` terminal command from this skill inside the default sandbox, including `open`, `status`, `session \*`, and `canvas document\.\*`\./);
  assert.match(skillSource, /Commands for different session IDs may run in parallel\./);
  assert.match(skillSource, /Commands that target the same session ID must run strictly serially\./);
  assert.match(skillSource, /`open`: only when you need to launch the desktop app itself\./);
  assert.match(skillSource, /`canvas document\.preview <session-id>`: PNG preview export\./);
  assert.match(skillSource, /If a command returns `APP_NOT_RUNNING`, or `status` returns `running: false`, run `ai-drawio open` yourself outside the sandbox and then continue with the original task\./);
  assert.doesNotMatch(skillSource, /Tell the user to open the desktop window manually before retrying\./);
  assert.match(skillSource, /`ai-drawio open` -> `references\/open\.md`/);
  assert.match(skillSource, /`ai-drawio session create` -> `references\/session-create\.md`/);
  assert.match(skillSource, /`ai-drawio canvas document\.preview` -> `references\/canvas-document-preview\.md`/);
  assert.doesNotMatch(skillSource, /--session|--session-title|--title/);
  assert.doesNotMatch(skillSource, /conversation create/);
  assert.match(openReferenceSource, /ai-drawio open/);
  assert.match(openReferenceSource, /ai-drawio open --mode window/);
  assert.match(openReferenceSource, /Use this when the desktop app is not running and the skill must launch it before continuing the original task\./);
  assert.match(statusReferenceSource, /ai-drawio status/);
  assert.match(statusReferenceSource, /If `running: false`, the skill should follow by running `ai-drawio open` outside the sandbox instead of asking the user to open the app manually\./);
  assert.match(previewReferenceSource, /ai-drawio canvas document\.preview sess-123/);
  assert.match(previewReferenceSource, /Every preview command must include the target session id as the first positional argument\./);
  assert.match(applyReferenceSource, /The prompt argument is required for every apply command\./);
  assert.match(applyReferenceSource, /Every apply command must include the target session id as the first positional argument\./);
  assert.match(applyReferenceSource, /Prefer inline XML when the XML is already in memory and fits safely in one command\./);
  assert.match(applyReferenceSource, /Use `--xml-file` only when the XML already exists on disk or an oversized inline payload requires a temporary file under the system temp directory\./);
  assert.match(applyReferenceSource, /Do not create temporary `\.drawio` files in the project directory\./);
  assert.match(agentSource, /Always include the required prompt argument when running `ai-drawio canvas document\.apply`/);
  assert.match(agentSource, /Do not execute any `ai-drawio` terminal command from this skill inside the default sandbox/);
  assert.match(agentSource, /run commands for different session IDs in parallel only when they do not target the same session/);
  assert.match(agentSource, /never run two `ai-drawio` commands concurrently against the same session ID/);
  assert.match(agentSource, /Use `ai-drawio open` when the task is to launch the desktop app itself/);
  assert.match(agentSource, /If a command returns `APP_NOT_RUNNING`, or `ai-drawio status` reports `running: false`, run `ai-drawio open` outside the sandbox and then continue with the original task instead of asking the user to launch the app manually/);
  assert.match(agentSource, /Use `ai-drawio canvas document\.preview <session-id>` for PNG preview export tasks/);
  assert.doesNotMatch(agentSource, /--session|--session-title|--title/);
  assert.match(schemaSource, /Arg::new\("session-id"\)\s*[\s\S]*\.index\(1\)/);
  assert.match(schemaSource, /Arg::new\("prompt"\)\s*[\s\S]*\.index\(2\)\s*[\s\S]*\.required\(true\)/);
});
