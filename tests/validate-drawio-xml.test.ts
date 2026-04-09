import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const VALIDATOR_PATH = new URL('../skills/ai-drawio-cli/scripts/validate_drawio_xml.py', import.meta.url);

function buildMxfile(pointsMarkup: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram id="page-1" name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="source" value="Source" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="40" height="40" as="geometry" />
        </mxCell>
        <mxCell id="target" value="Target" vertex="1" parent="1">
          <mxGeometry x="200" y="100" width="40" height="40" as="geometry" />
        </mxCell>
        <mxCell id="edge-1" edge="1" parent="1" source="source" target="target" style="endArrow=block;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
${pointsMarkup}
            </Array>
          </mxGeometry>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

async function runValidator(xmlSource: string) {
  const tempDir = await mkdtemp(join(tmpdir(), 'validate-drawio-xml-'));
  const xmlFile = join(tempDir, 'diagram.drawio');

  try {
    await writeFile(xmlFile, xmlSource, 'utf8');
    return await execFileAsync('python3', [VALIDATOR_PATH.pathname, xmlFile]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test('validate_drawio_xml flags a tee-like self-overlap caused by backtracking on one edge', async () => {
  const xmlSource = buildMxfile(`
              <mxPoint x="100" y="20" />
              <mxPoint x="100" y="120" />
              <mxPoint x="100" y="80" />
              <mxPoint x="220" y="80" />
  `);

  await assert.rejects(
    () => runValidator(xmlSource),
    (error: NodeJS.ErrnoException & { stdout?: string }) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout ?? '', /self-overlap|self-intersection|backtrack/i);
      return true;
    }
  );
});

test('validate_drawio_xml allows redundant colinear waypoints that only subdivide a straight segment', async () => {
  const xmlSource = buildMxfile(`
              <mxPoint x="100" y="20" />
              <mxPoint x="140" y="20" />
              <mxPoint x="180" y="20" />
              <mxPoint x="180" y="120" />
  `);

  const { stdout } = await runValidator(xmlSource);
  assert.match(stdout, /^OK: Page-1 /m);
  assert.doesNotMatch(stdout, /ERROR:/);
});
