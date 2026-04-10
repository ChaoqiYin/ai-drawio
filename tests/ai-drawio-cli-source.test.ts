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

  assert.match(skillSource, /All commands executed via `\$AI_DRAWIO_BIN` must run with elevated privileges in a non-sandboxed terminal\./);
  assert.match(skillSource, /`\/Applications\/AI Drawio\.app\/Contents\/MacOS\/ai-drawio` exists → store as `\$AI_DRAWIO_BIN`\./);
  assert.match(skillSource, /discover via `mdfind` per the loaded reference → store first valid result as `\$AI_DRAWIO_BIN`\./);
  assert.match(skillSource, /Prefer passing XML to `ai-drawio` through a temporary `\.drawio` file under the system temp directory unless the user explicitly asks for inline XML\./);
  assert.match(skillSource, /Reuse the session from the current AI conversation/);
  assert.match(skillSource, /Run `session create` for a new session \(load `references\/session-create\.md`\)\./);
  assert.match(
    skillSource,
    /Load `references\/command-selection\.md` and `references\/minimal-path-rule\.md`\./
  );
  assert.match(skillSource, /run `session close <session-id>`\./);
  assert.doesNotMatch(skillSource, /ai-drawio open/);
  assert.match(skillSource, /`bundle executable discovery` -> `references\/bundle-executable-discovery\.md`/);
  assert.doesNotMatch(skillSource, /launch installed app|references\/open\.md/);
  assert.match(skillSource, /`ai-drawio session create` -> `references\/session-create\.md`/);
  assert.match(skillSource, /`ai-drawio session close` -> `references\/session-close\.md`/);
  assert.match(skillSource, /`ai-drawio canvas document\.preview` -> `references\/canvas-document-preview\.md`/);
  assert.doesNotMatch(skillSource, /--session|--session-title|--title/);
  assert.doesNotMatch(skillSource, /conversation create/);
  assert.match(statusReferenceSource, /ai-drawio status/);
  assert.match(statusReferenceSource, /If `running: false`, launch the desktop app by executing the resolved packaged app path directly instead of asking the user to open the app manually\./);
  assert.match(discoveryReferenceSource, /Bundle executable discovery/);
  assert.match(discoveryReferenceSource, /\/Applications\/AI Drawio\.app\/Contents\/MacOS\/ai-drawio/);
  assert.match(discoveryReferenceSource, /mdfind/);
  assert.match(discoveryReferenceSource, /Do not fall back to PATH lookup/);
  assert.match(previewReferenceSource, /"\$AI_DRAWIO_BIN" canvas document\.preview sess-123/);
  assert.match(closeReferenceSource, /"\$AI_DRAWIO_BIN" session close sess-123/);
  assert.match(closeReferenceSource, /SESSION_NOT_OPEN/);
  assert.match(closeReferenceSource, /Prefer this command for end-of-task cleanup only when the current app state is tray state, unless the user explicitly wants the session kept open\./);
  assert.match(previewReferenceSource, /Every preview command must include the target session id as the first positional argument\./);
  assert.match(applyReferenceSource, /The prompt argument is required for every apply command\./);
  assert.match(applyReferenceSource, /Every apply command must include the target session id as the first positional argument\./);
  assert.match(applyReferenceSource, /Prefer `--xml-file` with a temporary file under the system temp directory for agent-generated XML payloads\./);
  assert.match(applyReferenceSource, /Use inline XML only when the user explicitly asks for it or the payload is trivially small\./);
  assert.match(applyReferenceSource, /Do not create temporary `\.drawio` files in the project directory\./);
  assert.match(agentSource, /Always include the required prompt argument when running `ai-drawio canvas document\.apply`/);
  assert.match(agentSource, /Do not execute any `ai-drawio` terminal command from this skill inside the default sandbox/);
  assert.match(agentSource, /resolve the packaged `ai-drawio` executable as an absolute path before running commands/i);
  assert.match(agentSource, /Run commands for different session IDs in parallel only when they do not target the same session/);
  assert.match(agentSource, /never run two `ai-drawio` commands concurrently against the same session ID/);
  assert.match(agentSource, /Launch the desktop app itself by executing the resolved packaged app path directly when needed\./);
  assert.doesNotMatch(agentSource, /ai-drawio open/);
  assert.match(agentSource, /Do not prefer `ai-drawio session list` when another command already satisfies the task\./);
  assert.match(
    agentSource,
    /If the user is continuing a diagram edit from the same AI conversation, reuse that conversation's most recent session id instead of creating a new session/
  );
  assert.match(agentSource, /If a command returns `APP_NOT_RUNNING`, or `ai-drawio status` reports `running: false`, execute the resolved packaged app path directly outside the sandbox and then continue with the original task instead of asking the user to launch the app manually/);
  assert.match(agentSource, /After a bounded task is fully complete, close the corresponding task session with `ai-drawio session close <session-id>` only when the current app state is tray state, unless the user explicitly wants that session kept open\./);
  assert.match(agentSource, /Use `ai-drawio canvas document\.preview <session-id>` for PNG preview export tasks/);
  assert.match(agentSource, /Prefer writing agent-generated XML payloads to a temporary `\.drawio` file under the system temp directory and passing that path with `--xml-file`/);
  assert.doesNotMatch(agentSource, /--session|--session-title|--title/);
  assert.match(schemaSource, /Arg::new\("session-id"\)\s*[\s\S]*\.index\(1\)/);
  assert.match(schemaSource, /Arg::new\("prompt"\)\s*[\s\S]*\.index\(2\)\s*[\s\S]*\.required\(true\)/);
  await assert.rejects(() => access(new URL("../skills/ai-drawio-cli/references/open.md", import.meta.url)));
});
