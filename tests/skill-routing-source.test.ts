import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const AI_DRAWIO_CLI_SKILL_PATH = new URL("../skills/ai-drawio-cli/SKILL.md", import.meta.url);
const AI_DRAWIO_CLI_AGENT_PATH = new URL("../skills/ai-drawio-cli/agents/openai.yaml", import.meta.url);
const DRAWIO_DIAGRAMMING_SKILL_PATH = new URL("../skills/drawio-diagramming/SKILL.md", import.meta.url);
const DRAWIO_DIAGRAMMING_AGENT_PATH = new URL("../skills/drawio-diagramming/agents/openai.yaml", import.meta.url);

test("draw.io execution skills require live apply instead of stopping at file generation", async () => {
  const [cliSkill, cliAgent, diagrammingSkill, diagrammingAgent] = await Promise.all([
    readFile(AI_DRAWIO_CLI_SKILL_PATH, "utf8"),
    readFile(AI_DRAWIO_CLI_AGENT_PATH, "utf8"),
    readFile(DRAWIO_DIAGRAMMING_SKILL_PATH, "utf8"),
    readFile(DRAWIO_DIAGRAMMING_AGENT_PATH, "utf8")
  ]);

  assert.match(
    cliSkill,
    /If XML authoring is needed before execution, treat that XML as an intermediate artifact and continue to the apply command\./
  );
  assert.match(
    cliAgent,
    /After preparing XML, continue in the same run by executing `ai-drawio canvas document\.apply`/
  );
  assert.match(
    diagrammingSkill,
    /If the user wants the diagram drawn, rendered, or applied in live draw\.io, you must also use `ai-drawio-cli` and continue to `canvas document\.apply`\./
  );
  assert.match(
    diagrammingAgent,
    /If the user wants the result applied in live draw\.io, also use `\$ai-drawio-cli` and do not stop at generating a `\.drawio` file\./
  );
});
