import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL(
  "../app/(internal)/_components/internal-breadcrumb.tsx",
  import.meta.url
);

test("internal breadcrumb centralizes the session-detail breadcrumb structure and navigation style", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /type InternalBreadcrumbProps = \{/);
  assert.match(source, /routes: InternalBreadcrumbRoute\[\]/);
  assert.match(source, /dataLayout\?: string/);
  assert.match(source, /useRouter/);
  assert.match(
    source,
    /const renderBreadcrumbItem = \(route: InternalBreadcrumbRoute, routes: InternalBreadcrumbRoute\[\]\): ReactNode => \{/
  );
  assert.match(source, /routes\.indexOf\(route\) === routes\.length - 1/);
  assert.match(source, /<span>\{route\.breadcrumbName\}<\/span>/);
  assert.match(
    source,
    /<button[\s\S]*type="button"[\s\S]*className="cursor-pointer border-0 bg-transparent p-0 text-inherit"[\s\S]*router\.push\(route\.path\)/
  );
  assert.match(
    source,
    /<Breadcrumb[\s\S]*data-layout=\{dataLayout \?\? 'workspace-breadcrumb'\}[\s\S]*routes=\{routes\}[\s\S]*itemRender=\{renderBreadcrumbItem\}/
  );
  assert.doesNotMatch(source, /<Breadcrumb\.Item/);
});
