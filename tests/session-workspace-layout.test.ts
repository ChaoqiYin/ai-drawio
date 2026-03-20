import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SOURCE_PATH = new URL("../app/(internal)/_components/session-workspace.tsx", import.meta.url);

test("session workspace uses a strict desktop flex shell structure", async () => {
  const source = await readFile(SOURCE_PATH, "utf8");

  assert.match(source, /@arco-design\/web-react/);
  assert.match(source, /Card/);
  assert.match(source, /Typography/);
  assert.match(source, /Tag/);
  assert.match(source, /Modal/);
  assert.match(source, /useWorkspaceSessionStore/);
  assert.match(source, /updateSessionMeta/);
  assert.match(source, /data-layout="workspace-body"/);
  assert.match(source, /data-layout="workspace-sidebar"/);
  assert.match(source, /data-layout="workspace-main"/);
  assert.match(source, /data-layout="workspace-main-canvas"/);
  assert.match(source, /internal-app-shell/);
  assert.match(source, /const shellClassName = 'internal-app-shell flex min-h-0 min-w-0 flex-1 overflow-hidden';/);
  assert.match(source, /toolbarSurfaceClassName/);
  assert.match(source, /sidebarSurfaceClassName/);
  assert.match(source, /const toolbarCardStyle = \{[\s\S]*borderRadius: 8,/);
  assert.match(source, /const pageShellClassName = 'flex min-h-0 min-w-0 flex-1 flex-col';/);
  assert.match(source, /min-h-0 min-w-0 flex flex-1 overflow-hidden gap-4 bg-transparent!/);
  assert.match(source, /min-h-0 flex min-w-0 flex-1 flex-col gap-4 lg:gap-\[18px\] bg-transparent!/);
  assert.match(source, /rounded-\[8px\][^"]*border border-\[rgba\(148,163,184,0\.2\)\]/);
  assert.match(source, /w-\[320px\] shrink-0/);
  assert.match(source, /<div className=\{shellBodyClassName\} data-layout="workspace-body">/);
  assert.match(source, /<div className=\{`\$\{sidebarClassName\} w-\[320px\] shrink-0`\} data-layout="workspace-sidebar">/);
  assert.match(source, /<div className=\{workspaceClassName\} data-layout="workspace-main">/);
  assert.match(source, /<div className=\{workspaceClassName\} data-layout="workspace-main">[\s\S]*<div className=\{workspaceCanvasClassName\} data-layout="workspace-main-canvas">/);
  assert.match(source, /width: ['"]100%['"],[\s\S]*height: ['"]100%['"]/);
  assert.match(source, /display: ['"]block['"]/);
  assert.match(source, /width: ['"]100%['"]/);
  assert.match(source, /height: ['"]100%['"]/);
  assert.doesNotMatch(source, /<Layout/);
  assert.doesNotMatch(source, /<Content/);
  assert.doesNotMatch(source, /<Sider/);
  assert.doesNotMatch(source, /canvasCardStyle/);
  assert.doesNotMatch(source, /bodyStyle=\{\{ padding: 0, height: ['"]100%['"], display: ['"]flex['"] \}\}/);
  assert.doesNotMatch(source, /internal-workspace-shell/);
  assert.doesNotMatch(source, /internal-workspace-toolbar-card/);
  assert.doesNotMatch(source, /internal-workspace-sidebar-card/);
  assert.doesNotMatch(source, /internal-workspace-main-toolbar/);
  assert.doesNotMatch(source, /internal-workspace-canvas-frame/);
  assert.doesNotMatch(source, /internal-gradient-text/);
  assert.doesNotMatch(source, /linear-gradient/);
  assert.doesNotMatch(source, /radial-gradient/);
  assert.doesNotMatch(source, /data-layout="workspace-main-toolbar"/);
  assert.doesNotMatch(source, /workspace-head/);
  assert.doesNotMatch(source, /嵌入式画布工作区/);
  assert.doesNotMatch(source, /draw\.io 画布/);
  assert.doesNotMatch(source, /当前会话已加载/);
  assert.doesNotMatch(source, /等待会话加载/);
  assert.doesNotMatch(source, /mb-4!/);
  assert.doesNotMatch(source, /mb-\[18px\][^"]*lg:mb-\[22px\]/);
  assert.doesNotMatch(source, /const pageShellClassName = '.*p-\[18px\]/);
  assert.doesNotMatch(source, /const pageShellClassName = '.*lg:p-\[22px\]/);
  assert.doesNotMatch(source, /const pageShellClassName = '.*px-\[18px\]/);
  assert.doesNotMatch(source, /const pageShellClassName = '.*pb-\[18px\]/);
  assert.doesNotMatch(source, /const pageShellClassName = '.*pt-\[8px\]/);
  assert.doesNotMatch(source, /borderRadius: 20,/);
  assert.doesNotMatch(source, /rounded-\[24px\]/);
  assert.doesNotMatch(source, /h-screen/);
  assert.doesNotMatch(source, /theme="light"/);
  assert.doesNotMatch(source, /theme="dark"/);
  assert.doesNotMatch(source, /extra=\{conversation \? <Text type="secondary">\{conversation\.id\}<\/Text> : null\}/);
  assert.doesNotMatch(source, /<Text type="secondary" style=\{\{ maxWidth: 420, textAlign: 'right', wordBreak: 'break-all' \}\}>\s*\{DRAWIO_EMBED_PATH\}\s*<\/Text>/);
  assert.doesNotMatch(
    source,
    /页面结构固定为顶部工作区头部与下方主体区。主体区严格拆成左侧会话栏和右侧画布工作区。/
  );
  assert.doesNotMatch(source, /同源 iframe 工作区，使用嵌入协议桥接文档读写。/);
  assert.doesNotMatch(source, /左栏固定宽度，右侧为工具条与画布的垂直弹性布局。/);
});
