import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const CLI_SKILL_PATH = new URL("../skills/ai-drawio-cli/SKILL.md", import.meta.url);
const CLI_STATUS_REFERENCE_PATH = new URL("../skills/ai-drawio-cli/references/status.md", import.meta.url);
const CLI_DISCOVERY_REFERENCE_PATH = new URL(
  "../skills/ai-drawio-cli/references/bundle-executable-discovery.md",
  import.meta.url
);
const CLI_PREVIEW_REFERENCE_PATH = new URL(
  "../skills/ai-drawio-cli/references/canvas-document-preview.md",
  import.meta.url
);
const CLI_APPLY_REFERENCE_PATH = new URL(
  "../skills/ai-drawio-cli/references/canvas-document-apply.md",
  import.meta.url
);
const CLI_CLOSE_REFERENCE_PATH = new URL(
  "../skills/ai-drawio-cli/references/session-close.md",
  import.meta.url
);
const CLI_AGENT_PATH = new URL("../skills/ai-drawio-cli/agents/openai.yaml", import.meta.url);
const CLI_SCHEMA_PATH = new URL("../src-tauri/src/cli_schema.rs", import.meta.url);

test("ai-drawio cli skill covers the current command surface and session-scoped concurrency", async () => {
  const [
    skillSource,
    statusReferenceSource,
    discoveryReferenceSource,
    previewReferenceSource,
    applyReferenceSource,
    closeReferenceSource,
    agentSource,
    schemaSource
  ] = await Promise.all([
    readFile(CLI_SKILL_PATH, "utf8"),
    readFile(CLI_STATUS_REFERENCE_PATH, "utf8"),
    readFile(CLI_DISCOVERY_REFERENCE_PATH, "utf8"),
    readFile(CLI_PREVIEW_REFERENCE_PATH, "utf8"),
    readFile(CLI_APPLY_REFERENCE_PATH, "utf8"),
    readFile(CLI_CLOSE_REFERENCE_PATH, "utf8"),
    readFile(CLI_AGENT_PATH, "utf8"),
    readFile(CLI_SCHEMA_PATH, "utf8")
  ]);

  assert.match(skillSource, /Resolve the packaged `ai-drawio` executable to an absolute path before running any CLI command\./);
  assert.match(skillSource, /Do not rely on PATH lookup or shell command discovery for `ai-drawio`\./);
  assert.match(skillSource, /If the packaged app is installed in the default macOS location, prefer `\/Applications\/AI Drawio\.app\/Contents\/MacOS\/ai-drawio`\./);
  assert.match(skillSource, /If the default location is unavailable, discover the actual app bundle path first and then keep using the resolved executable path consistently for the rest of the task\./);
  assert.match(skillSource, /Every `canvas document\.apply` command must include a required prompt argument with the user request summary\./);
  assert.match(skillSource, /Do not generate a `\.drawio` file unless the user explicitly asked for file output or the XML payload is too large for a safe inline command\./);
  assert.match(skillSource, /Use `session create` when the user needs a new ready session\./);
  assert.match(skillSource, /If this skill opens or creates a session for a bounded task, close that same session with `session close <session-id>` after the full task is complete, unless the user explicitly wants the session kept open\./);
  assert.match(skillSource, /Do not execute any `ai-drawio` terminal command from this skill inside the default sandbox, including `status`, `session \*`, and `canvas document\.\*`\./);
  assert.match(skillSource, /Commands for different session IDs may run in parallel\./);
  assert.match(skillSource, /Commands that target the same session ID must run strictly serially\./);
  assert.match(skillSource, /Launch the desktop app itself by executing the resolved packaged app path directly\./);
  assert.doesNotMatch(skillSource, /ai-drawio open/);
  assert.match(skillSource, /`canvas document\.preview <session-id>`: PNG preview export\./);
  assert.match(skillSource, /If a command returns `APP_NOT_RUNNING`, or `status` returns `running: false`, execute the resolved packaged app path directly outside the sandbox and then continue with the original task\./);
  assert.doesNotMatch(skillSource, /Tell the user to open the desktop window manually before retrying\./);
  assert.match(skillSource, /`bundle executable discovery` -> `references\/bundle-executable-discovery\.md`/);
  assert.doesNotMatch(skillSource, /launch installed app|references\/open\.md/);
  assert.match(skillSource, /`ai-drawio session create` -> `references\/session-create\.md`/);
  assert.match(skillSource, /`ai-drawio session close` -> `references\/session-close\.md`/);
  assert.match(skillSource, /`ai-drawio canvas document\.preview` -> `references\/canvas-document-preview\.md`/);
  assert.match(skillSource, /Do not prefer `session list` when another command already satisfies the task\./);
  assert.doesNotMatch(skillSource, /--session|--session-title|--title/);
  assert.doesNotMatch(skillSource, /conversation create/);
  assert.match(statusReferenceSource, /ai-drawio status/);
  assert.match(statusReferenceSource, /If `running: false`, the skill should follow by executing the resolved packaged app path directly outside the sandbox instead of asking the user to open the app manually\./);
  assert.match(discoveryReferenceSource, /Bundle executable discovery/);
  assert.match(discoveryReferenceSource, /\/Applications\/AI Drawio\.app\/Contents\/MacOS\/ai-drawio/);
  assert.match(discoveryReferenceSource, /mdfind/);
  assert.match(discoveryReferenceSource, /Do not fall back to PATH lookup/);
  assert.match(previewReferenceSource, /"\$AI_DRAWIO_BIN" canvas document\.preview sess-123/);
  assert.match(closeReferenceSource, /"\$AI_DRAWIO_BIN" session close sess-123/);
  assert.match(closeReferenceSource, /SESSION_NOT_OPEN/);
  assert.match(closeReferenceSource, /Prefer this command for end-of-task cleanup unless the user explicitly wants the session kept open\./);
  assert.match(previewReferenceSource, /Every preview command must include the target session id as the first positional argument\./);
  assert.match(applyReferenceSource, /The prompt argument is required for every apply command\./);
  assert.match(applyReferenceSource, /Every apply command must include the target session id as the first positional argument\./);
  assert.match(applyReferenceSource, /Prefer inline XML when the XML is already in memory and fits safely in one command\./);
  assert.match(applyReferenceSource, /Use `--xml-file` only when the XML already exists on disk or an oversized inline payload requires a temporary file under the system temp directory\./);
  assert.match(applyReferenceSource, /Do not create temporary `\.drawio` files in the project directory\./);
  assert.match(agentSource, /Always include the required prompt argument when running `ai-drawio canvas document\.apply`/);
  assert.match(agentSource, /Do not execute any `ai-drawio` terminal command from this skill inside the default sandbox/);
  assert.match(agentSource, /resolve the packaged `ai-drawio` executable as an absolute path before running commands/i);
  assert.match(agentSource, /Run commands for different session IDs in parallel only when they do not target the same session/);
  assert.match(agentSource, /never run two `ai-drawio` commands concurrently against the same session ID/);
  assert.match(agentSource, /Launch the desktop app itself by executing the resolved packaged app path directly when needed\./);
  assert.doesNotMatch(agentSource, /ai-drawio open/);
  assert.match(agentSource, /Do not prefer `ai-drawio session list` when another command already satisfies the task\./);
  assert.match(agentSource, /If a command returns `APP_NOT_RUNNING`, or `ai-drawio status` reports `running: false`, execute the resolved packaged app path directly outside the sandbox and then continue with the original task instead of asking the user to launch the app manually/);
  assert.match(agentSource, /After a bounded task is fully complete, close the corresponding task session with `ai-drawio session close <session-id>` unless the user explicitly wants that session kept open\./);
  assert.match(agentSource, /Use `ai-drawio canvas document\.preview <session-id>` for PNG preview export tasks/);
  assert.doesNotMatch(agentSource, /--session|--session-title|--title/);
  assert.match(schemaSource, /Arg::new\("session-id"\)\s*[\s\S]*\.index\(1\)/);
  assert.match(schemaSource, /Arg::new\("prompt"\)\s*[\s\S]*\.index\(2\)\s*[\s\S]*\.required\(true\)/);
  await assert.rejects(() => access(new URL("../skills/ai-drawio-cli/references/open.md", import.meta.url)));
});
