# Mermaid 转 draw.io 执行流程记录

## 1. 任务目标

将 [`detailed-design.md`](/Users/admin/workspace/other/test-drawio/detailed-design.md) 中的 Mermaid 图形转换为 draw.io 文档，并生成可在 draw.io 中打开的 `.drawio` 文件。

## 2. 输入内容确认

源文件中共识别出 6 个 Mermaid 图：

1. 总体架构设计
2. 核心模块设计
3. 关键业务流程设计
4. 角色权限设计
5. 关键数据模型设计
6. 部署拓扑设计

对应 Mermaid 类型包括：

- `flowchart`
- `sequenceDiagram`
- `erDiagram`

## 3. 执行步骤

### 3.1 读取上下文与技能说明

先读取以下内容，确认当前仓库约束和 `ai-drawio` 的命令面：

- `detailed-design.md`
- `using-superpowers` 技能说明
- `ai-drawio-cli` 技能说明
- `ai-drawio-cli/references/cli-commands.md`

目标是确认：

- 需要转换的图数量和类型
- 当前仓库是否已有现成 `.drawio` 文件
- `ai-drawio` 是否支持直接导入 XML

### 3.2 检查当前工作区

通过文件扫描确认仓库内仅有：

- `detailed-design.md`

因此决定新建一个多页 draw.io 文档，而不是在已有文档上追加。

### 3.3 检查 ai-drawio 状态

执行 `ai-drawio status`，确认本地桌面控制服务已运行，但会话桥接状态并不完全稳定。

同时创建了一个本地会话以便后续画布操作。

### 3.4 确认导入策略

实际探查后，采用的策略不是“逐个 Mermaid 在线绘制”，而是：

1. 先根据 Mermaid 结构手工生成 draw.io XML
2. 将 6 张图组织成一个多页 `.drawio` 文档
3. 再尝试通过 `ai-drawio` 导入当前会话

这样做的原因是：

- 当前 CLI 更稳定支持 XML 文档级操作
- 多页文档更适合统一管理
- 便于直接落地可交付产物

### 3.5 生成 draw.io 文件

新建文件：

- [`detailed-design.drawio`](/Users/admin/workspace/other/test-drawio/detailed-design.drawio)

文档包含 6 个页面：

- `Architecture`
- `Modules`
- `Approval Flow`
- `Roles and Permissions`
- `Data Model`
- `Deployment`

由于当前仓库要求生成的 XML 文件使用英文内容，因此图中的中文标签被翻译为英文后写入 `.drawio`。

### 3.6 文件校验

对生成结果进行了两类静态校验：

1. XML 结构校验
2. 非 ASCII 字符检查

执行结果：

- `xmllint --noout detailed-design.drawio` 通过
- `xmllint --xpath 'count(/mxfile/diagram)' detailed-design.drawio` 返回 `6`
- 非 ASCII 检查未发现异常字符

### 3.7 尝试导入 draw.io 会话

先后尝试了以下命令：

```bash
ai-drawio canvas document.restore --xml-file ./detailed-design.drawio
ai-drawio canvas document.apply --xml-file ./detailed-design.drawio
ai-drawio canvas document.apply ./detailed-design.drawio
```

过程中发现两个实际问题：

1. 当前 `ai-drawio` 实现并不支持 `document.restore`
2. `document.apply` 在当前环境下持续超时

超时错误为：

```text
desktop control server did not become ready in time
```

### 3.8 尝试前台唤起桌面应用

为排除桌面应用未真正进入可控状态的情况，又执行了以下操作：

```bash
ai-drawio open
open -a "/Applications/AI Drawio.app"
open -a "/Applications/AI Drawio.app" /Users/admin/workspace/other/test-drawio/detailed-design.drawio
```

结果：

- 桌面版 draw.io 可以被系统直接打开
- 生成的 `.drawio` 文件也可以直接交给桌面应用打开
- 但 `ai-drawio` 的桥接层仍然在 `document.apply` 和 `document.svg` 阶段超时

### 3.9 尝试导出 SVG 验证

最后尝试通过 CLI 导出 SVG：

```bash
ai-drawio canvas document.svg --output-file ./detailed-design-svg
```

结果同样失败，错误仍为：

```text
desktop control server did not become ready in time
```

因此未拿到自动导出的 SVG 文件，目录 [`detailed-design-svg`](/Users/admin/workspace/other/test-drawio/detailed-design-svg) 为空。

## 4. 最终产物

本次任务实际生成并保留的文件：

- [`detailed-design.drawio`](/Users/admin/workspace/other/test-drawio/detailed-design.drawio)
- [`drawio-execution-flow.md`](/Users/admin/workspace/other/test-drawio/drawio-execution-flow.md)

辅助目录：

- [`detailed-design-svg`](/Users/admin/workspace/other/test-drawio/detailed-design-svg)

## 5. 结果结论

本次任务已经完成了以下核心目标：

- 从 `detailed-design.md` 中识别并整理出 6 个 Mermaid 图
- 生成一个可交付的多页 draw.io 文档
- 完成 XML 结构层面的静态校验

尚未完成的部分：

- 通过 `ai-drawio` CLI 成功导入当前桌面会话
- 通过 `ai-drawio` CLI 自动导出 SVG 进行最终画布级验证

## 6. 后续建议

如果后续还要继续使用 `ai-drawio` 做自动化绘图，建议优先排查以下方向：

1. 桌面控制服务是否与当前 draw.io 桌面实例版本完全匹配
2. 当前会话桥接是否已经完成前台激活
3. `document.apply` 的真实参数格式是否与参考文档存在差异
4. 是否需要通过指定会话 ID 的方式减少自动解析带来的不稳定性

在当前状态下，最稳妥的交付方式仍然是直接使用已生成的 `.drawio` 文件。
