# Draw.io XML Authoring

## Contents

- Document model
- Basic `mxGraphModel` structure
- Common cell patterns
- Useful style properties
- XML well-formedness checklist
- Official references

## Document model

Draw.io documents are often wrapped in an `mxfile` document, while each diagram page contains an `mxGraphModel`. When editing a full `.drawio` file, preserve the outer `mxfile` and patch only the relevant diagram content. When authoring a single diagram body, use a valid `mxGraphModel`.

## Basic `mxGraphModel` structure

Every diagram page must contain this minimum structure:

```xml
<mxGraphModel>
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>
    <!-- Diagram cells go here with parent="1" unless a container is used -->
  </root>
</mxGraphModel>
```

- Cell `id="0"` is the root layer.
- Cell `id="1"` is the default parent layer.
- Diagram elements usually use `parent="1"` unless they belong to a container or another layer.

## Common cell patterns

Rounded rectangle:

```xml
<mxCell id="2" value="Label" style="rounded=1;whiteSpace=wrap;" vertex="1" parent="1">
  <mxGeometry x="100" y="100" width="120" height="60" as="geometry"/>
</mxCell>
```

Diamond:

```xml
<mxCell id="3" value="Condition?" style="rhombus;whiteSpace=wrap;" vertex="1" parent="1">
  <mxGeometry x="100" y="200" width="120" height="80" as="geometry"/>
</mxCell>
```

Arrow:

```xml
<mxCell id="4" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="2" target="3" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

Labeled arrow:

```xml
<mxCell id="5" value="Yes" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="3" target="6" parent="1">
  <mxGeometry relative="1" as="geometry"/>
</mxCell>
```

## Useful style properties

| Property | Values | Use |
| --- | --- | --- |
| `rounded=1` | `0` or `1` | Rounded corners |
| `whiteSpace=wrap` | `wrap` | Text wrapping |
| `fillColor=#dae8fc` | Hex color | Background color |
| `strokeColor=#6c8ebf` | Hex color | Border color |
| `fontColor=#333333` | Hex color | Text color |
| `shape=cylinder3` | Shape name | Database cylinder |
| `shape=mxgraph.flowchart.document` | Shape name | Document shape |
| `ellipse` | Style keyword | Circle or oval |
| `rhombus` | Style keyword | Decision diamond |
| `edgeStyle=orthogonalEdgeStyle` | Style keyword | Right-angle connector |
| `edgeStyle=elbowEdgeStyle` | Style keyword | Elbow connector |
| `dashed=1` | `0` or `1` | Dashed line |
| `swimlane` | Style keyword | Swimlane container |
| `group` | Style keyword | Invisible group container |
| `container=1` | `0` or `1` | Enable container behavior |
| `pointerEvents=0` | `0` or `1` | Prevent container from capturing child connections |

## XML well-formedness checklist

- Never reuse an `mxCell` ID.
- Escape special characters in attribute values: `&amp;`, `&lt;`, `&gt;`, `&quot;`.
- Never use double hyphens inside XML comments.
- Keep edges in expanded form with a nested `mxGeometry` element.
- Preserve `parent`, `source`, and `target` references when patching XML.
- Prefer editing the smallest valid fragment instead of rewriting unrelated cells.

## Official references

- Style reference: `https://www.drawio.com/doc/faq/drawio-style-reference.html`
- XML schema: `https://www.drawio.com/assets/mxfile.xsd`
