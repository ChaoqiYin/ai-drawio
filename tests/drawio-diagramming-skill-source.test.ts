import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const DRAWIO_DIAGRAMMING_SKILL_PATH = new URL('../skills/drawio-diagramming/SKILL.md', import.meta.url);
const DRAWIO_DIAGRAMMING_AGENT_PATH = new URL('../skills/drawio-diagramming/agents/openai.yaml', import.meta.url);
const LAYOUT_REFERENCE_PATH = new URL(
  '../skills/drawio-diagramming/references/layout-and-containers.md',
  import.meta.url
);

test('drawio diagramming skill defaults to non-overlapping shapes and low-crossing connectors', async () => {
  const [skillSource, agentSource, layoutReferenceSource] = await Promise.all([
    readFile(DRAWIO_DIAGRAMMING_SKILL_PATH, 'utf8'),
    readFile(DRAWIO_DIAGRAMMING_AGENT_PATH, 'utf8'),
    readFile(LAYOUT_REFERENCE_PATH, 'utf8')
  ]);

  assert.match(
    skillSource,
    /Unless the user explicitly says which objects may overlap, treat overlap-free layout as a required layout property rather than a preference\./
  );
  assert.match(
    skillSource,
    /Treat containers as layout boundaries rather than overlap violations for their child content\./
  );
  assert.match(
    skillSource,
    /Minimize connector crossings by default and accept them only when the alternative would make the layout less readable\./
  );
  assert.match(
    skillSource,
    /For opposing left-to-right flows, favor layered columns and direct center-to-center channels before introducing detours\./
  );
  assert.match(
    agentSource,
    /Default to non-overlapping ordinary shapes, keep connectors off shape areas, treat containers as exceptions for child layout, and minimize connector crossings\./
  );
  assert.match(
    agentSource,
    /For dense diagrams, plan connector channels first and use explicit waypoints for critical edges instead of relying on automatic orthogonal routing\./
  );
  assert.match(
    layoutReferenceSource,
    /Do not let ordinary nodes overlap other ordinary nodes or connector segments\./
  );
  assert.match(
    layoutReferenceSource,
    /Use containers to hold child content, but do not treat that containment as a node-overlap violation\./
  );
  assert.match(
    layoutReferenceSource,
    /Prefer routing that avoids connector crossings entirely; if a crossing is unavoidable, keep the count and visual impact as low as possible\./
  );
  assert.match(
    layoutReferenceSource,
    /Plan layers, columns, and connector channels before compacting the layout\./
  );
  assert.match(
    layoutReferenceSource,
    /Do not rely on automatic orthogonal routing alone for dense or compact diagrams; give critical edges explicit exits, entries, and waypoints\./
  );
  assert.match(
    layoutReferenceSource,
    /For live canvas work, validate geometry after rendering: a successful apply or preview only proves the document renders, not that overlaps are gone\./
  );
});
