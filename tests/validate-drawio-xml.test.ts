import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const VALIDATOR_PATH = new URL('../skills/ai-drawio-cli/scripts/validate_drawio_xml.py', import.meta.url);
const VENDORED_PYELK_PATH = new URL('../skills/ai-drawio-cli/vendor/pyelk', import.meta.url);

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

function buildCustomMxfile(options: {
  edgeStyle?: string;
  edgeGeometryMarkup?: string;
  sourceGeometry?: string;
  targetGeometry?: string;
} = {}): string {
  const edgeStyle = options.edgeStyle ?? 'endArrow=block;';
  const edgeGeometryMarkup =
    options.edgeGeometryMarkup ?? '<mxGeometry relative="1" as="geometry" />';
  const sourceGeometry =
    options.sourceGeometry ?? '<mxGeometry x="0" y="0" width="40" height="40" as="geometry" />';
  const targetGeometry =
    options.targetGeometry ?? '<mxGeometry x="200" y="100" width="40" height="40" as="geometry" />';

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram id="page-1" name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="source" value="Source" vertex="1" parent="1">
          ${sourceGeometry}
        </mxCell>
        <mxCell id="target" value="Target" vertex="1" parent="1">
          ${targetGeometry}
        </mxCell>
        <mxCell id="edge-1" edge="1" parent="1" source="source" target="target" style="${edgeStyle}">
          ${edgeGeometryMarkup}
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

function buildCellsMxfile(cellsMarkup: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram id="page-1" name="Page-1">
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${cellsMarkup}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

async function runValidator(xmlSource: string, extraArgs: string[] = []) {
  const tempDir = await mkdtemp(join(tmpdir(), 'validate-drawio-xml-'));
  const xmlFile = join(tempDir, 'diagram.drawio');

  try {
    await writeFile(xmlFile, xmlSource, 'utf8');
    const result = await execFileAsync('python3', [VALIDATOR_PATH.pathname, ...extraArgs, xmlFile]);
    return {
      ...result,
      tempDir,
      xmlFile,
    };
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

test('validate_drawio_xml no longer exposes auto-route flags or vendored pyelk', async () => {
  const [validatorSource, helpResult] = await Promise.all([
    readFile(VALIDATOR_PATH, 'utf8'),
    execFileAsync('python3', [VALIDATOR_PATH.pathname, '--help']),
  ]);

  assert.doesNotMatch(validatorSource, /VENDORED_PYELK_ROOT/);
  assert.doesNotMatch(validatorSource, /def _load_pyelk/);
  assert.doesNotMatch(validatorSource, /def _auto_route_single_page/);
  assert.doesNotMatch(validatorSource, /--auto-route/);
  assert.doesNotMatch(validatorSource, /autoRouteOutput/);
  assert.doesNotMatch(helpResult.stdout, /--auto-route/);
  await assert.rejects(() => access(VENDORED_PYELK_PATH));
});

test('validate_drawio_xml requires every edge to define mxGeometry with relative=1 and as=geometry', async () => {
  const xmlSource = buildCustomMxfile({
    edgeGeometryMarkup: '',
  });

  await assert.rejects(
    () => runValidator(xmlSource),
    (error: NodeJS.ErrnoException & { stdout?: string }) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout ?? '', /Edge mxCell edge-1 is missing mxGeometry/i);
      return true;
    }
  );
});

test('validate_drawio_xml rejects out-of-range entry and exit anchors', async () => {
  const xmlSource = buildCustomMxfile({
    edgeStyle: 'endArrow=block;exitX=1.2;exitY=0.5;entryX=0;entryY=-0.1;',
    edgeGeometryMarkup: `
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="120" y="20" />
              <mxPoint x="120" y="120" />
            </Array>
          </mxGeometry>
    `,
  });

  await assert.rejects(
    () => runValidator(xmlSource),
    (error: NodeJS.ErrnoException & { stdout?: string }) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout ?? '', /exitX.*must be within \[0,1\]/i);
      assert.match(error.stdout ?? '', /entryY.*must be within \[0,1\]/i);
      return true;
    }
  );
});

test('validate_drawio_xml enforces target-side final segment direction and endpoint clearance', async () => {
  const xmlSource = buildCustomMxfile({
    edgeStyle: 'endArrow=block;entryX=0;entryY=0.5;entryPerimeter=0;',
    edgeGeometryMarkup: `
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="180" y="90" />
              <mxPoint x="200" y="110" />
            </Array>
          </mxGeometry>
    `,
  });

  await assert.rejects(
    () => runValidator(xmlSource),
    (error: NodeJS.ErrnoException & { stdout?: string }) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout ?? '', /final segment.*horizontal.*target/i);
      assert.match(error.stdout ?? '', /at least 20px of straight segment before the target/i);
      assert.match(error.stdout ?? '', /edge-1 final segment\[\d+\]/i);
      assert.match(error.stdout ?? '', /\(200,110\)->\(200,120\)/i);
      assert.match(error.stdout ?? '', /length=10(\.00)?/i);
      return true;
    }
  );
});

test('validate_drawio_xml reports connector-through-shape with segment coordinates and vertex rect', async () => {
  const xmlSource = buildCellsMxfile(`
        <mxCell id="source" value="Source" vertex="1" parent="1">
          <mxGeometry x="0" y="0" width="40" height="40" as="geometry" />
        </mxCell>
        <mxCell id="blocker" value="Blocker" vertex="1" parent="1">
          <mxGeometry x="90" y="40" width="60" height="60" as="geometry" />
        </mxCell>
        <mxCell id="target" value="Target" vertex="1" parent="1">
          <mxGeometry x="200" y="100" width="40" height="40" as="geometry" />
        </mxCell>
        <mxCell id="edge-1" edge="1" parent="1" source="source" target="target" style="endArrow=block;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="120" y="20" />
              <mxPoint x="120" y="120" />
            </Array>
          </mxGeometry>
        </mxCell>
  `);

  await assert.rejects(
    () => runValidator(xmlSource),
    (error: NodeJS.ErrnoException & { stdout?: string }) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout ?? '', /Connector-through-shape/i);
      assert.match(error.stdout ?? '', /edge edge-1 segment\[\d+\]/i);
      assert.match(error.stdout ?? '', /\(120,20\)->\(120,120\)/i);
      assert.match(error.stdout ?? '', /vertex blocker/i);
      assert.match(error.stdout ?? '', /rect=\(90,40,60,60\)/i);
      return true;
    }
  );
});

test('validate_drawio_xml reports edge crossings with segment coordinates and intersection point', async () => {
  const xmlSource = buildCellsMxfile(`
        <mxCell id="left-mid" value="Left Mid" vertex="1" parent="1">
          <mxGeometry x="0" y="100" width="40" height="40" as="geometry" />
        </mxCell>
        <mxCell id="right-mid" value="Right Mid" vertex="1" parent="1">
          <mxGeometry x="200" y="100" width="40" height="40" as="geometry" />
        </mxCell>
        <mxCell id="top-mid" value="Top Mid" vertex="1" parent="1">
          <mxGeometry x="100" y="0" width="40" height="40" as="geometry" />
        </mxCell>
        <mxCell id="bottom-mid" value="Bottom Mid" vertex="1" parent="1">
          <mxGeometry x="100" y="200" width="40" height="40" as="geometry" />
        </mxCell>
        <mxCell id="edge-a" edge="1" parent="1" source="left-mid" target="right-mid" style="endArrow=block;exitX=1;exitY=0.5;entryX=0;entryY=0.5;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="edge-b" edge="1" parent="1" source="top-mid" target="bottom-mid" style="endArrow=block;exitX=0.5;exitY=1;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
  `);

  await assert.rejects(
    () => runValidator(xmlSource),
    (error: NodeJS.ErrnoException & { stdout?: string }) => {
      assert.equal(error.code, 1);
      assert.match(error.stdout ?? '', /Edge crossing detected between edge-a segment\[\d+\].*edge-b segment\[\d+\]/i);
      assert.match(error.stdout ?? '', /edge-a .*?\(40,120\)->\(200,120\)/i);
      assert.match(error.stdout ?? '', /edge-b .*?\(120,40\)->\(120,200\)/i);
      assert.match(error.stdout ?? '', /at \(120\.00,120\.00\)/i);
      return true;
    }
  );
});
