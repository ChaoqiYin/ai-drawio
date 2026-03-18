import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CLI_SKILL_PATH = new URL("../skills/ai-drawio-cli/SKILL.md", import.meta.url);
const CLI_APPLY_REFERENCE_PATH = new URL(
  "../skills/ai-drawio-cli/references/canvas-document-apply.md",
  import.meta.url
);
const CLI_AGENT_PATH = new URL("../skills/ai-drawio-cli/agents/openai.yaml", import.meta.url);
const CLI_SCHEMA_PATH = new URL("../src-tauri/src/cli_schema.rs", import.meta.url);

test("ai-drawio cli apply guidance requires --prompt and avoids file generation by default", async () => {
  const [skillSource, referenceSource, agentSource, schemaSource] = await Promise.all([
    readFile(CLI_SKILL_PATH, "utf8"),
    readFile(CLI_APPLY_REFERENCE_PATH, "utf8"),
    readFile(CLI_AGENT_PATH, "utf8"),
    readFile(CLI_SCHEMA_PATH, "utf8")
  ]);

  assert.match(skillSource, /Every `canvas document\.apply` command must include a required prompt argument with the user request summary\./);
  assert.match(skillSource, /Do not generate a `\.drawio` file unless the user explicitly asked for file output or the XML payload is too large for a safe inline command\./);
  assert.match(referenceSource, /The prompt argument is required for every apply command\./);
  assert.match(referenceSource, /Prefer inline XML when the XML is already in memory and fits safely in one command\./);
  assert.match(referenceSource, /Use `--xml-file` only when the XML already exists on disk or an oversized inline payload requires a temporary file under the system temp directory\./);
  assert.match(referenceSource, /Do not create temporary `\.drawio` files in the project directory\./);
  assert.match(agentSource, /Always include the required prompt argument when running `ai-drawio canvas document\.apply`/);
  assert.match(schemaSource, /Arg::new\("prompt"\)\.index\(1\)\.value_name\("prompt"\)\.required\(true\)/);
});
