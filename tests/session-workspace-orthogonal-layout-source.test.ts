import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const WORKSPACE_SOURCE_PATH = new URL(
  '../app/(internal)/_components/session-workspace.tsx',
  import.meta.url,
);
const PACKAGE_JSON_PATH = new URL('../package.json', import.meta.url);

test('session workspace no longer exposes orthogonal layout actions or elkjs wiring', async () => {
  const [workspaceSource, packageJsonSource] = await Promise.all([
    readFile(WORKSPACE_SOURCE_PATH, 'utf8'),
    readFile(PACKAGE_JSON_PATH, 'utf8'),
  ]);

  assert.doesNotMatch(packageJsonSource, /"elkjs"/);
  assert.doesNotMatch(workspaceSource, /elkjs/);
  assert.doesNotMatch(workspaceSource, /OrthogonalLayoutPreset/);
  assert.doesNotMatch(workspaceSource, /aiDrawioApplyOrthogonalLayout/);
  assert.doesNotMatch(workspaceSource, /applyOrthogonalLayout/);
  assert.doesNotMatch(workspaceSource, /ensureOrthogonalToolbarButton/);
  assert.doesNotMatch(workspaceSource, /scheduleOrthogonalToolbarInjection/);
  assert.doesNotMatch(workspaceSource, /syncOrthogonalToolbarButtonState/);
  assert.doesNotMatch(workspaceSource, /buildOrthogonalElkGraph/);
  assert.doesNotMatch(workspaceSource, /buildTopLevelLayoutScope/);
  assert.doesNotMatch(workspaceSource, /extractElkEdgeRoute/);
  assert.doesNotMatch(workspaceSource, /resolveRelativeAnchor/);
  assert.doesNotMatch(workspaceSource, /roundLayoutCoordinate/);
  assert.doesNotMatch(workspaceSource, /ORTHOGONAL_/);
  assert.doesNotMatch(workspaceSource, /正交布局/);
  assert.doesNotMatch(workspaceSource, /data-ai-drawio-orthogonal-preset/);
  assert.doesNotMatch(workspaceSource, /orthogonal-layout/);
});
